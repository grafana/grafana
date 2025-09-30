import { css } from '@emotion/css';
import { useState, useCallback, useEffect } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Grid, Spinner } from '@grafana/ui';
import { CosmicSceneIcon } from 'app/features/browse-dashboards/hackathon14/CosmicSceneIcon';
import { useGetRecentAlerts, useGetPopularAlerts } from 'app/features/dashboard/api/popularResourcesApi';
import { useLLMStream, StreamStatus } from 'app/features/dashboard/components/GenAI/hooks';
import { Role, DEFAULT_LLM_MODEL, isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';
import { AISuggestionStyleContainer } from 'app/features/browse-dashboards/hackathon14/AISuggestionStyleContainer';

interface AlertRecommendation {
  uid: string;
  title: string;
  reason: string;
  relevance: number;
  state: string;
  folder: string;
}

interface RecommendationCardProps {
  recommendation: AlertRecommendation;
  onAlertClick: (uid: string) => void;
  styles: ReturnType<typeof getStyles>;
}

const RecommendationCard = ({ recommendation, onAlertClick, styles }: RecommendationCardProps) => {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Card
      className={styles.recommendationCard}
      onClick={() => onAlertClick(recommendation.uid)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <Stack direction="column" gap={1.5}>
        <Stack direction="row" gap={2} alignItems="flex-start" justifyContent="space-between">
          <div className={styles.titleWrapper}>
            <Stack direction="row" gap={1} alignItems="center">
              <Icon
                name="bell"
                size="sm"
                className={styles.alertIcon}
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

        <Stack direction="row" gap={2} alignItems="center">
          <Stack direction="row" gap={0.5} alignItems="center">
            <Icon
              name="folder"
              size="xs"
              className={styles.metaIcon}
              style={{
                filter: isHovered ? 'drop-shadow(0 0 4px rgba(139, 92, 246, 0.5))' : 'none',
              }}
            />
            <Text variant="bodySmall" color="secondary">
              {recommendation.folder}
            </Text>
          </Stack>
          <div
            className={`${styles.stateBadge} ${
              recommendation.state === 'firing'
                ? styles.firing
                : recommendation.state === 'pending'
                  ? styles.pending
                  : styles.normal
            }`}
          >
            {recommendation.state === 'firing' && <Icon name="fire" size="xs" />}
            <Text variant="bodySmall">{recommendation.state}</Text>
          </div>
        </Stack>
      </Stack>
    </Card>
  );
};

interface AlertSearchAISuggestionProps {
  searchQuery?: string;
  filters?: {
    firing: boolean;
    ownedByMe: boolean;
  };
}

export const AlertSearchAISuggestion = ({ searchQuery = '', filters }: AlertSearchAISuggestionProps) => {
  const styles = useStyles2(getStyles);
  const [recommendations, setRecommendations] = useState<AlertRecommendation[]>([]);
  const [hasRequested, setHasRequested] = useState(false);

  // Check if LLM plugin is enabled
  const { value: llmEnabled, loading: llmLoading } = useAsync(async () => {
    return await isLLMPluginEnabled();
  }, []);

  // Get context from recent and popular alerts
  const { data: recentData } = useGetRecentAlerts({ limit: 10 });
  const { data: popularData } = useGetPopularAlerts({ limit: 10 });

  const onResponse = useCallback(
    (response: string) => {
      try {
        // Parse LLM response - expecting JSON array of recommendations
        const parsed = JSON.parse(response);
        setRecommendations(parsed);
      } catch (error) {
        console.error('Failed to parse LLM alert recommendations:', error);
        // Fallback: show popular alerts that might match the query
        if (popularData?.resources) {
          const filtered = popularData.resources
            .filter((r) => r.title.toLowerCase().includes(searchQuery.toLowerCase()))
            .slice(0, 3);
          setRecommendations(
            filtered.map((r) => ({
              uid: r.uid,
              title: r.title,
              reason: 'Matches your search and is frequently triggered',
              relevance: 0.75,
              state: 'normal',
              folder: 'General',
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

  const hasActiveFilters = filters?.firing || filters?.ownedByMe || (searchQuery && searchQuery.trim().length > 0);

  const getRecommendations = useCallback(() => {
    if (!hasActiveFilters) {
      return;
    }

    // Build context from available alerts
    const availableAlerts = [
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
    const uniqueAlerts = Array.from(new Map(availableAlerts.map((a) => [a.uid, a])).values());

    const systemPrompt = `You are a Grafana alert rule search assistant. Your job is to recommend the most relevant alert rules based on a user's search query.

Return ONLY a valid JSON array with this exact format (no markdown, no code blocks):
[
  {
    "uid": "alert-uid",
    "title": "Alert Rule Name",
    "reason": "Brief 1-sentence explanation of why this is relevant to the search",
    "relevance": 0.95,
    "state": "firing",
    "folder": "Production"
  }
]

Rules:
- Analyze the search query and match it to the most relevant alert rules
- Consider alert titles, keywords, monitoring objectives, and context
- State can be: "firing", "normal", "pending"
- Folder should be inferred from context or set to "General"
- Relevance score should be 0.6-1.0 based on match quality
- Provide specific, actionable reasons for each recommendation
- Prioritize alerts that are currently firing or critical
- Return up to 4 recommendations, prioritizing best matches
- If no exact matches, suggest related monitoring alerts
${filters?.firing ? '- IMPORTANT: Only recommend alerts with state "firing"' : ''}
${filters?.ownedByMe ? '- IMPORTANT: Only recommend alerts created by the user' : ''}`;

    const alertContext =
      uniqueAlerts.length > 0
        ? `Available Alert Rules:
${uniqueAlerts
  .map((a) => `- "${a.title}" (UID: ${a.uid}, Recent visits: ${a.visits})`)
  .slice(0, 20)
  .join('\n')}`
        : 'No alert history available. Suggest general monitoring categories that might match the search.';

    const filterContext = [];
    if (filters?.firing) {
      filterContext.push('Only FIRING alerts');
    }
    if (filters?.ownedByMe) {
      filterContext.push('Only alerts created by me');
    }

    const userPrompt = `Search Query: "${searchQuery || '(No search query - showing filtered results)'}"
${filterContext.length > 0 ? `Active Filters: ${filterContext.join(', ')}` : ''}

${alertContext}

Based on this ${searchQuery ? 'search query' : 'filter criteria'} and available alert rules, what are the most relevant alerts to recommend?`;

    setMessages([
      { role: Role.system, content: systemPrompt },
      { role: Role.user, content: userPrompt },
    ]);
    setHasRequested(true);
  }, [searchQuery, recentData, popularData, setMessages, filters]);

  // Auto-trigger recommendations when search query or filters change
  useEffect(() => {
    if (!llmEnabled || llmLoading || !hasActiveFilters) {
      return;
    }

    const timer = setTimeout(() => {
      getRecommendations();
    }, 500);

    return () => clearTimeout(timer);
  }, [searchQuery, filters?.firing, filters?.ownedByMe, llmEnabled, llmLoading, getRecommendations, hasActiveFilters]);

  const handleAlertClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

  const isGenerating = streamStatus === StreamStatus.GENERATING;
  const hasRecommendations = recommendations.length > 0;

  // Don't show anything if LLM is not enabled
  if (llmLoading || !llmEnabled) {
    return null;
  }

  return (
    <AISuggestionStyleContainer handleRefresh={() => {}} hasRecommendations={hasRecommendations}>
      <div className={styles.content}>
        {/* isGenerating */}
        {isGenerating && (
          <Stack direction="column" gap={2} alignItems="center">
            <CosmicSceneIcon />
            <Stack direction="column" gap={0.5} alignItems="center">
              <Text variant="h5">Analyzing alert patterns...</Text>
              <Stack direction="row" gap={1} alignItems="center">
                <Text variant="bodySmall" color="secondary">
                  Finding the most relevant alerts
                </Text>
              </Stack>
            </Stack>
          </Stack>
        )}

        {!isGenerating && hasRecommendations && (
          <Grid gap={2} columns={{ xs: 1, sm: 2 }}>
            {recommendations.map((recommendation, idx) => (
              <RecommendationCard
                key={`${recommendation.uid}-${idx}`}
                recommendation={recommendation}
                onAlertClick={handleAlertClick}
                styles={styles}
              />
            ))}
          </Grid>
        )}

        {error && (
          <Card className={styles.errorCard}>
            <Stack direction="column" gap={1} alignItems="center">
              <Icon name="exclamation-triangle" size="lg" />
              <Text color="error">Failed to generate AI recommendations</Text>
              <Text variant="bodySmall" color="secondary">
                Try the normal search instead
              </Text>
            </Stack>
          </Card>
        )}

        {!isGenerating && !hasRecommendations && !error && hasRequested && (
          <Card className={styles.emptyCard}>
            <Text color="secondary">No AI recommendations available for this search</Text>
          </Card>
        )}
      </div>
    </AISuggestionStyleContainer>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    marginBottom: theme.spacing(4),
  }),

  content: css({
    marginTop: theme.spacing(2),
  }),

  loadingCard: css({
    padding: theme.spacing(4),
    background: 'transparent',
    border: 'none',
    boxShadow: 'none',
    textAlign: 'center',
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
        opacity: 0.5,
      },
    },
  }),

  titleWrapper: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  }),

  alertIcon: css({
    flexShrink: 0,
    color: theme.colors.warning.main,
    transition: 'filter 0.3s ease',
  }),

  cardTitle: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  relevanceBadge: css({
    flexShrink: 0,
    padding: theme.spacing(0.5, 1.5),
    borderRadius: theme.shape.radius.pill,
    background: 'linear-gradient(135deg, #d946ef, #8b5cf6)',
    color: '#fff',
    fontWeight: 600,
    transition: 'box-shadow 0.3s ease',
  }),

  metaIcon: css({
    flexShrink: 0,
    color: theme.colors.text.secondary,
    transition: 'filter 0.3s ease',
  }),

  stateBadge: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.25, 1),
    borderRadius: theme.shape.radius.pill,
    fontSize: theme.typography.bodySmall.fontSize,
    textTransform: 'capitalize',
  }),

  firing: css({
    backgroundColor: theme.colors.error.main + '20',
    color: theme.colors.error.text,
  }),

  normal: css({
    backgroundColor: theme.colors.success.main + '20',
    color: theme.colors.success.text,
  }),

  pending: css({
    backgroundColor: theme.colors.warning.main + '20',
    color: theme.colors.warning.text,
  }),

  errorCard: css({
    padding: theme.spacing(3),
    textAlign: 'center',
  }),

  emptyCard: css({
    padding: theme.spacing(3),
    textAlign: 'center',
    background: theme.colors.background.secondary,
  }),
});
