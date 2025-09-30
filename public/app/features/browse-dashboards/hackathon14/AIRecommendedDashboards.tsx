import { css } from '@emotion/css';
import { useState, useCallback, useEffect } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Spinner, Button, Grid } from '@grafana/ui';
import { 
  useGetRecentDashboardsAndFolders,
  useGetPopularDashboards,
} from 'app/features/dashboard/api/popularResourcesApi';
import { useLLMStream, StreamStatus } from 'app/features/dashboard/components/GenAI/hooks';
import { Role, DEFAULT_LLM_MODEL, isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

interface DashboardRecommendation {
  uid: string;
  title: string;
  reason: string;
  confidence: number;
}

export const AIRecommendedDashboards = () => {
  const styles = useStyles2(getStyles);
  const [recommendations, setRecommendations] = useState<DashboardRecommendation[]>([]);
  const [hasRequested, setHasRequested] = useState(false);

  // Check if LLM plugin is enabled
  const { value: llmEnabled, loading: llmLoading } = useAsync(async () => {
    return await isLLMPluginEnabled();
  }, []);

  // Get user context from recent and popular dashboards
  const { data: recentData } = useGetRecentDashboardsAndFolders({ limit: 10, period: '30d' });
  const { data: popularData } = useGetPopularDashboards({ limit: 10, period: '30d' });

  const onResponse = useCallback((response: string) => {
    try {
      // Parse LLM response - expecting JSON array of recommendations
      const parsed = JSON.parse(response);
      setRecommendations(parsed);
    } catch (error) {
      console.error('Failed to parse LLM recommendations:', error);
      // Fallback to showing popular dashboards
      if (popularData?.resources) {
        setRecommendations(
          popularData.resources.slice(0, 3).map((r) => ({
            uid: r.uid,
            title: r.title,
            reason: 'Popular in your organization',
            confidence: 0.8,
          }))
        );
      }
    }
  }, [popularData]);

  const { setMessages, streamStatus, error } = useLLMStream({
    model: DEFAULT_LLM_MODEL,
    temperature: 0.7,
    onResponse,
  });

  const getRecommendations = useCallback(() => {
    if (hasRequested) {return;}

    const recentTitles = recentData?.resources?.map((r) => r.title).slice(0, 5) || [];
    const popularTitles = popularData?.resources?.map((r) => r.title).slice(0, 5) || [];

    const hasNoContext = recentTitles.length === 0 && popularTitles.length === 0;

    const systemPrompt = hasNoContext
      ? `You are a Grafana dashboard expert. A new user is exploring Grafana for the first time. Recommend 5 popular, essential dashboard types they should create or explore.

Return ONLY a valid JSON array with this exact format (no markdown, no code blocks):
[
  {
    "uid": "suggestion-1",
    "title": "Dashboard Category Name",
    "reason": "Brief 1-sentence value proposition",
    "confidence": 0.8
  }
]

Rules:
- Suggest common, useful dashboard types (e.g., Infrastructure Monitoring, Application Performance, Business Metrics)
- Each reason must explain the value to new users
- For uid, use: "suggestion-1", "suggestion-2", etc. (these are category suggestions, not actual dashboards)
- Confidence should be 0.75-0.85
- Return exactly 5 recommendations`
      : `You are a Grafana dashboard recommendation assistant. Based on user context, recommend 5 relevant dashboards they might want to explore.

Return ONLY a valid JSON array with this exact format (no markdown, no code blocks):
[
  {
    "uid": "example-uid",
    "title": "Recommended Dashboard Name",
    "reason": "Brief 1-sentence reason why this is recommended",
    "confidence": 0.9
  }
]

Rules:
- Recommend dashboards from the available context
- Each reason must be specific and helpful
- Confidence should be 0.7-0.95
- Return exactly 5 recommendations`;

    const userPrompt = hasNoContext
      ? `The user is brand new to Grafana with no dashboard history. What 5 types of dashboards should they start exploring?`
      : `User Context:
Recently Visited: ${recentTitles.join(', ')}
Popular Dashboards: ${popularTitles.join(', ')}

Based on this context, what 5 dashboards should this user explore next?`;

    setMessages([
      { role: Role.system, content: systemPrompt },
      { role: Role.user, content: userPrompt },
    ]);
    setHasRequested(true);
  }, [recentData, popularData, hasRequested, setMessages]);

  // Auto-trigger recommendations on mount when in empty state
  useEffect(() => {
    // Only proceed if LLM is enabled
    if (!llmEnabled || llmLoading) {
      return;
    }

    // Wait for data to load, then trigger if empty state
    if (recentData && popularData && !hasRequested) {
      const hasNoData = 
        (!recentData.resources || recentData.resources.length === 0) &&
        (!popularData.resources || popularData.resources.length === 0);
      
      if (hasNoData) {
        getRecommendations();
      }
    }
  }, [recentData, popularData, hasRequested, getRecommendations, llmEnabled, llmLoading]);

  const isGenerating = streamStatus === StreamStatus.GENERATING;
  const hasRecommendations = recommendations.length > 0;

  const handleDashboardClick = (uid: string, title: string) => {
    // Only navigate if it looks like a real dashboard UID (not generic placeholder)
    // Real UIDs are typically short alphanumeric strings, not descriptive names
    const isPlaceholder = 
      !uid ||
      uid.includes('suggestion') ||
      uid.includes('getting-started') ||
      uid.includes('example') ||
      uid.includes('monitoring') ||
      uid.includes('dashboard') ||
      uid.includes('performance') ||
      uid.includes('infrastructure') ||
      uid.includes('application') ||
      uid.includes('business') ||
      uid.includes('metrics') ||
      uid.includes('analytics') ||
      uid.includes('network') ||
      uid.includes('log') ||
      uid.length > 30; // Real UIDs are usually shorter
    
    if (isPlaceholder) {
      // For AI suggestions, search for dashboards matching this category
      const searchQuery = encodeURIComponent(title);
      window.location.href = `/dashboards?search=${searchQuery}`;
    } else {
      // For real dashboards, navigate directly
      window.location.href = `/d/${uid}`;
    }
  };

  const handleRefresh = () => {
    setHasRequested(false);
    setRecommendations([]);
    // Will auto-trigger on next render
  };

  // Don't render if LLM is not enabled or still checking
  if (llmLoading) {
    return null;
  }

  if (!llmEnabled) {
    return null; // Silently hide component if LLM plugin is not installed
  }

  return (
    <div className={styles.wrapper}>
      <Stack direction="row" gap={2} alignItems="baseline" justifyContent="space-between">
        <Stack direction="row" gap={2} alignItems="center">
          <Icon name="ai" size="xl" className={styles.titleIcon} />
          <div>
            <div className={styles.title}>
              <Text variant="h4">AI Recommended for You</Text>
            </div>
            <div className={styles.subtitle}>
              <Text variant="bodySmall" color="secondary">
                Powered by <span className={styles.highlight}>agentic LLM assistant</span>
              </Text>
            </div>
          </div>
        </Stack>
        {hasRecommendations && (
          <Button size="sm" variant="secondary" icon="sync" onClick={handleRefresh} className={styles.refreshButton}>
            Refresh
          </Button>
        )}
      </Stack>

      <div className={styles.container}>
        {isGenerating && (
          <Card className={styles.loadingCard}>
            <Stack direction="row" gap={2} alignItems="center">
              <Spinner />
              <Text>Analyzing your dashboard activity...</Text>
            </Stack>
          </Card>
        )}

        {error && (
          <Card className={styles.errorCard}>
            <Stack direction="row" gap={2} alignItems="center">
              <Icon name="exclamation-triangle" />
              <Text color="error">Failed to generate recommendations</Text>
            </Stack>
          </Card>
        )}

        {!isGenerating && hasRecommendations && (
          <div>
            <Grid gap={3} columns={{ xs: 1, sm: 2 }}>
              {recommendations.map((rec) => {
                // All cards are now clickable:
                // - Real dashboards navigate to the dashboard
                // - AI suggestions search for that category
                return (
                  <Card
                    key={rec.uid}
                    className={styles.recommendationCard}
                    onClick={() => handleDashboardClick(rec.uid, rec.title)}
                  >
                    <Stack direction="column" gap={2}>
                      <Stack direction="row" gap={2} alignItems="center" justifyContent="space-between">
                        <div className={styles.titleWrapper}>
                          <Stack direction="row" gap={1} alignItems="center">
                            <Icon name="ai" className={styles.aiIcon} />
                            <div className={styles.cardTitle}>
                              <Text weight="medium">{rec.title}</Text>
                            </div>
                          </Stack>
                        </div>
                        <div className={styles.confidenceBadge}>
                          <Text variant="bodySmall">
                            {Math.round(rec.confidence * 100)}%
                          </Text>
                        </div>
                      </Stack>
                      <Text variant="bodySmall" color="secondary">
                        {rec.reason}
                      </Text>
                    </Stack>
                  </Card>
                );
              })}
            </Grid>
          </div>
        )}

        {!isGenerating && !hasRecommendations && !error && hasRequested && (
          <Card className={styles.emptyCard}>
            <Text color="secondary">No recommendations available at the moment</Text>
          </Card>
        )}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    paddingLeft: theme.spacing(6),
    paddingRight: theme.spacing(6),
  }),

  titleIcon: css({
    color: '#d946ef',
    filter: 'drop-shadow(0 0 12px rgba(217, 70, 239, 0.6))',
  }),

  title: css({
    background: 'linear-gradient(135deg, #d946ef, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    backgroundClip: 'text',
    fontWeight: 600,
  }),

  subtitle: css({
    marginTop: theme.spacing(0.5),
  }),

  highlight: css({
    color: '#d946ef',
    fontWeight: 500,
  }),

  refreshButton: css({
    background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.1), rgba(139, 92, 246, 0.1))',
    border: '1px solid rgba(217, 70, 239, 0.3)',
    
    '&:hover': {
      background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.2), rgba(139, 92, 246, 0.2))',
      border: '1px solid rgba(217, 70, 239, 0.5)',
    },
  }),

  container: css({
    marginTop: theme.spacing(3),
  }),

  loadingCard: css({
    padding: theme.spacing(3),
    background: 'linear-gradient(135deg, rgba(217, 70, 239, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%)',
    border: '2px solid',
    borderImage: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #6366f1) 1',
    borderRadius: theme.shape.radius.default,
  }),

  errorCard: css({
    padding: theme.spacing(2),
    backgroundColor: theme.colors.error.transparent,
  }),

  recommendationCard: css({
    padding: theme.spacing(2.5),
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    position: 'relative',
    background: theme.colors.background.primary,
    border: '2px solid transparent',
    backgroundClip: 'padding-box',
    borderRadius: theme.shape.radius.default,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #6366f1)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0.3,
      transition: 'opacity 0.3s ease',
    },
    
    '&:hover': {
      transform: 'translateY(-4px)',
      boxShadow: '0 8px 24px rgba(217, 70, 239, 0.25)',
      
      '&::before': {
        opacity: 0.5,
      },
    },
  }),

  suggestionCard: css({
    padding: theme.spacing(2.5),
    transition: 'all 0.3s ease',
    position: 'relative',
    background: theme.colors.background.primary,
    border: '2px solid transparent',
    backgroundClip: 'padding-box',
    borderRadius: theme.shape.radius.default,
    cursor: 'default',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    
    '&::before': {
      content: '""',
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      padding: '2px',
      background: 'linear-gradient(90deg, #f59e0b, #ef4444, #ec4899, #8b5cf6, #6366f1)',
      WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
      WebkitMaskComposite: 'xor',
      maskComposite: 'exclude',
      opacity: 0.4,
    },
  }),

  aiIcon: css({
    color: '#d946ef', // Magenta color from Grafana Assistant
    filter: 'drop-shadow(0 0 8px rgba(217, 70, 239, 0.5))',
    flexShrink: 0,
  }),

  titleWrapper: css({
    flex: 1,
    minWidth: 0,
    overflow: 'hidden',
  }),

  cardTitle: css({
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  }),

  confidenceBadge: css({
    padding: theme.spacing(0.5, 1),
    background: 'linear-gradient(135deg, #ec4899, #8b5cf6)',
    borderRadius: theme.shape.radius.pill,
    whiteSpace: 'nowrap',
    fontWeight: 600,
    color: '#fff',
    flexShrink: 0,
  }),

  disclaimerCard: css({
    padding: theme.spacing(1.5),
    background: 'rgba(217, 70, 239, 0.05)',
    border: '1px solid rgba(217, 70, 239, 0.2)',
    borderRadius: theme.shape.radius.default,
    marginTop: theme.spacing(3),
  }),

  emptyCard: css({
    padding: theme.spacing(3),
    textAlign: 'center',
  }),
});
