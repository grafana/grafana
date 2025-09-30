import { css } from '@emotion/css';
import { useState, useCallback, useEffect } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Spinner, Grid, Button } from '@grafana/ui';
import {
  useGetRecentDashboards,
  useGetPopularDashboards,
} from 'app/features/dashboard/api/popularResourcesApi';
import { useLLMStream, StreamStatus } from 'app/features/dashboard/components/GenAI/hooks';
import { Role, DEFAULT_LLM_MODEL, isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

interface DashboardRecommendation {
  uid: string;
  title: string;
  reason: string;
  relevance: number;
  popularity: string;
}

interface RecommendationCardProps {
  recommendation: DashboardRecommendation;
  onDashboardClick: (uid: string) => void;
  styles: ReturnType<typeof getStyles>;
}

const RecommendationCard = ({ recommendation, onDashboardClick, styles }: RecommendationCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className={styles.recommendationCard}
      onClick={() => onDashboardClick(recommendation.uid)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Stack direction="column" gap={1.5}>
        <Stack direction="row" gap={2} alignItems="flex-start" justifyContent="space-between">
          <div className={styles.titleWrapper}>
            <Stack direction="row" gap={1} alignItems="center">
              <Icon
                name="apps"
                size="sm"
                className={styles.dashboardIcon}
                style={{
                  filter: isHovered ? 'drop-shadow(0 0 6px rgba(217, 70, 239, 0.6))' : 'none',
                }}
              />
              <div className={styles.cardTitle}>
                <Text weight="medium">{recommendation.title}</Text>
              </div>
            </Stack>
          </div>
          <div
            className={styles.relevanceBadge}
            style={{
              boxShadow: isHovered ? '0 0 16px rgba(217, 70, 239, 0.8)' : '0 0 0px rgba(217, 70, 239, 0)',
            }}
          >
            <Text variant="bodySmall">{Math.round(recommendation.relevance * 100)}%</Text>
          </div>
        </Stack>

        <Text variant="bodySmall" color="secondary">
          {recommendation.reason}
        </Text>

        <Stack direction="row" gap={1} alignItems="center">
          <Icon
            name="eye"
            size="xs"
            className={styles.popularityIcon}
            style={{
              filter: isHovered ? 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.5))' : 'none',
            }}
          />
          <Text variant="bodySmall" color="secondary">
            {recommendation.popularity}
          </Text>
        </Stack>
      </Stack>
    </Card>
  );
};

interface SearchResultAIRecommendationProps {
  searchQuery: string;
}

export const SearchResultAIRecommendation = ({ searchQuery }: SearchResultAIRecommendationProps) => {
  const styles = useStyles2(getStyles);
  const [recommendations, setRecommendations] = useState<DashboardRecommendation[]>([]);
  const [hasRequested, setHasRequested] = useState(false);

  // Check if LLM plugin is enabled
  const { value: llmEnabled, loading: llmLoading } = useAsync(async () => {
    return await isLLMPluginEnabled();
  }, []);

  // Get context from recent and popular dashboards
  const { data: recentData } = useGetRecentDashboards({ limit: 10, period: '30d' });
  const { data: popularData } = useGetPopularDashboards({ limit: 10, period: '30d' });

  const onResponse = useCallback(
    (response: string) => {
      try {
        // Parse LLM response - expecting JSON array of recommendations
        const parsed = JSON.parse(response);
        setRecommendations(parsed);
      } catch (error) {
        console.error('Failed to parse LLM search recommendations:', error);
        // Fallback: show popular dashboards that might match the query
        if (popularData?.resources) {
          const filtered = popularData.resources
            .filter((r) => r.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .slice(0, 3);
          setRecommendations(
            filtered.map((r) => ({
              uid: r.uid,
              title: r.title,
              reason: 'Matches your search and is popular in your organization',
              relevance: 0.75,
              popularity: `${r.visitCount} visits`,
            }))
          );
        }
      }
    },
    [popularData, searchQuery]
  );

  const { setMessages, streamStatus, error } = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.5,
    onResponse,
  });

  const getRecommendations = useCallback(() => {
    if (!searchQuery || searchQuery.trim().length === 0) {
      return;
    }

    // Build context from available dashboards
    const availableDashboards = [
      ...(recentData?.resources || []).map((r) => ({
        title: r.title,
        uid: r.uid,
        visits: r.visitCount || 0,
        lastVisited: r.lastVisited,
      })),
      ...(popularData?.resources || []).map((r) => ({
        title: r.title,
        uid: r.uid,
        visits: r.visitCount || 0,
        lastVisited: r.lastVisited,
      })),
    ];

    // Remove duplicates by UID
    const uniqueDashboards = Array.from(new Map(availableDashboards.map((d) => [d.uid, d])).values());

    const systemPrompt = `You are a Grafana dashboard search assistant. Your job is to recommend the most relevant dashboards based on a user's search query.

Return ONLY a valid JSON array with this exact format (no markdown, no code blocks):
[
  {
    "uid": "dashboard-uid",
    "title": "Dashboard Name",
    "reason": "Brief 1-sentence explanation of why this is relevant to the search",
    "relevance": 0.95,
    "popularity": "High usage: 150 visits"
  }
]

Rules:
- Analyze the search query and match it to the most relevant dashboards
- Consider dashboard titles, keywords, and context
- Include visit count/popularity information in the "popularity" field
- Relevance score should be 0.6-1.0 based on match quality
- Provide specific, actionable reasons for each recommendation
- Return up to 4 recommendations, prioritizing best matches
- If no exact matches, suggest related or similar dashboards`;

    const dashboardContext =
      uniqueDashboards.length > 0
        ? `Available Dashboards:
${uniqueDashboards
  .map((d) => `- "${d.title}" (UID: ${d.uid}, Visits: ${d.visits})`)
  .slice(0, 20)
  .join('\n')}`
        : 'No dashboard history available. Suggest general dashboard categories that might match the search.';

    const userPrompt = `Search Query: "${searchQuery}"

${dashboardContext}

Based on this search query and available dashboards, what are the most relevant dashboards to recommend?`;

    setMessages([
      { role: Role.system, content: systemPrompt },
      { role: Role.user, content: userPrompt },
    ]);
    setHasRequested(true);
  }, [searchQuery, recentData, popularData, setMessages]);

  // Auto-trigger recommendations when search query changes
  useEffect(() => {
    if (!llmEnabled || llmLoading || !searchQuery || searchQuery.trim().length === 0) {
      return;
    }

    // Reset and fetch new recommendations when query changes
    setHasRequested(false);
    setRecommendations([]);
  }, [searchQuery, llmEnabled, llmLoading]);

  // Trigger recommendations once data is ready
  useEffect(() => {
    if (!llmEnabled || llmLoading || hasRequested) {
      return;
    }

    if (recentData && popularData && searchQuery && searchQuery.trim().length > 0) {
      getRecommendations();
    }
  }, [recentData, popularData, hasRequested, getRecommendations, llmEnabled, llmLoading, searchQuery]);

  const isGenerating = streamStatus === StreamStatus.GENERATING;
  const hasRecommendations = recommendations.length > 0;

  const handleDashboardClick = (uid: string) => {
    // Navigate to dashboard
    window.location.href = `/d/${uid}`;
  };

  const handleRefresh = () => {
    setHasRequested(false);
    setRecommendations([]);
  };

  // Don't render if LLM is not enabled or no search query
  if (llmLoading || !llmEnabled || !searchQuery || searchQuery.trim().length === 0) {
    return null;
  }

    return (
    <div className={styles.container}>
      <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
        <Stack direction="row" gap={2} alignItems="center">
          <Icon name="ai" size="lg" className={styles.titleIcon} />
          <div>
            <div className={styles.title}>
              <Text variant="h5">AI Recommended Based on Your Search</Text>
            </div>
            <Text variant="bodySmall" color="secondary">
              Smart suggestions powered by{' '}
              <span className={styles.highlight}>LLM analysis</span>
            </Text>
          </div>
        </Stack>
        {hasRecommendations && (
          <Button size="sm" variant="secondary" icon="sync" onClick={handleRefresh} className={styles.refreshButton}>
            Refresh
          </Button>
        )}
      </Stack>

      <div className={styles.content}>
        {isGenerating && (
          <Card className={styles.loadingCard}>
            <Stack direction="row" gap={2} alignItems="center">
              <Spinner />
              <Text>Analyzing search context and dashboard relevance...</Text>
            </Stack>
          </Card>
        )}

        {error && (
          <Card className={styles.errorCard}>
            <Stack direction="row" gap={2} alignItems="center">
              <Icon name="exclamation-triangle" />
              <Text color="error">Failed to generate AI recommendations</Text>
            </Stack>
          </Card>
        )}

        {!isGenerating && hasRecommendations && (
          <Grid gap={2} columns={{ xs: 1, sm: 2 }}>
            {recommendations.map((rec) => (
              <RecommendationCard
                key={rec.uid}
                recommendation={rec}
                onDashboardClick={handleDashboardClick}
                styles={styles}
              />
            ))}
          </Grid>
        )}

        {!isGenerating && !hasRecommendations && !error && hasRequested && (
          <Card className={styles.emptyCard}>
            <Text color="secondary">No AI recommendations available for this search</Text>
          </Card>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(4),
    padding: theme.spacing(3),
    background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.05) 0%, rgba(139, 92, 246, 0.05) 100%)',
    borderRadius: theme.shape.radius.default,
    border: '1px solid rgba(217, 70, 239, 0.2)',
  }),

  titleIcon: css({
    color: '#d946ef',
    filter: 'drop-shadow(0 0 8px rgba(217, 70, 239, 0.5))',
  }),

  title: css({
    background: 'linear-gradient(135deg, #d946ef, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: 600,
  }),

  highlight: css({
    color: '#d946ef',
    fontWeight: 500,
  }),

  refreshButton: css({
    background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.1), rgba(139, 92, 246, 0.1))',
    border: '2px solid rgba(217, 70, 239, 0.3)',
    transition: 'all 0.3s ease',

    '&:hover': {
      background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.2), rgba(139, 92, 246, 0.2))',
      border: '2px solid rgba(217, 70, 239, 0.6)',
      transform: 'translateY(-2px)',
      boxShadow: '0 0 20px rgba(217, 70, 239, 0.4)',
    },
  }),

  content: css({
    marginTop: theme.spacing(2),
  }),

  loadingCard: css({
    padding: theme.spacing(2),
    background: 'rgba(217, 70, 239, 0.05)',
    border: '1px solid rgba(217, 70, 239, 0.2)',
  }),

  errorCard: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.error.transparent,
  }),

  recommendationCard: css({
    padding: theme.spacing(2),
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    background: theme.colors.background.primary,
    border: '2px solid transparent',
    borderRadius: theme.shape.radius.default,

    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #d946ef, #8b5cf6, #6366f1)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0.3,
      transition: 'opacity 0.3s ease',
    },

    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 16px rgba(217, 70, 239, 0.25)',

      '&::before': {
        opacity: 0.6,
      },
    },
  }),

  titleWrapper: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  }),

  dashboardIcon: css({
    color: '#d946ef',
    flexShrink: 0,
    transition: 'filter 0.3s ease',
  }),

  cardTitle: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  relevanceBadge: css({
    padding: theme.spacing(0.5, 1),
    background: 'linear-gradient(135deg, #d946ef, #8b5cf6)',
    borderRadius: theme.shape.radius.pill,
    whiteSpace: 'nowrap',
    fontWeight: 600,
    color: '#fff',
    flexShrink: 0,
    transition: 'all 0.3s ease',
  }),

  popularityIcon: css({
    color: '#8b5cf6',
    flexShrink: 0,
    transition: 'filter 0.3s ease',
  }),

  emptyCard: css({
    padding: theme.spacing(2),
    textAlign: 'center',
  }),
});