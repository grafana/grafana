import { css } from '@emotion/css';
import { useState, useEffect } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Spinner, Grid, Switch } from '@grafana/ui';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';

import { AlertSearchAISuggestion } from './AlertSearchAISuggestion';

interface NormalSuggestion {
  uid: string;
  title: string;
  state: string;
  folder: string;
  score: number;
}

interface AlertSearchSuggestionProps {
  query?: string;
  filters?: {
    firing: boolean;
    ownedByMe: boolean;
  };
}

export const AlertSearchSuggestion = ({ query = '', filters }: AlertSearchSuggestionProps) => {
  const styles = useStyles2(getStyles);
  const [useAI, setUseAI] = useState(false);
  const [normalSuggestions, setNormalSuggestions] = useState<NormalSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if LLM plugin is enabled
  const { value: llmEnabled } = useAsync(async () => {
    return await isLLMPluginEnabled();
  }, []);

  const hasActiveFilters = filters?.firing || filters?.ownedByMe || (query && query.trim().length > 0);

  useEffect(() => {
    if (!useAI && hasActiveFilters) {
      fetchNormalSuggestions();
    }
  }, [query, useAI, filters?.firing, filters?.ownedByMe, hasActiveFilters]);

  const fetchNormalSuggestions = async () => {
    setLoading(true);
    setError(null);

    try {
      // Mock alert rules search - in a real implementation, this would call an API
      const mockAlerts = [
        { uid: '1', title: 'High CPU Usage Alert', state: 'firing', folder: 'Production' },
        { uid: '2', title: 'Disk Space Warning', state: 'normal', folder: 'Infrastructure' },
        { uid: '3', title: 'API Response Time', state: 'firing', folder: 'APIs' },
        { uid: '4', title: 'Memory Usage Critical', state: 'firing', folder: 'Production' },
        { uid: '5', title: 'Database Connection Pool', state: 'normal', folder: 'Database' },
        { uid: '6', title: 'Network Latency Alert', state: 'normal', folder: 'Infrastructure' },
        { uid: '7', title: 'Error Rate Threshold', state: 'firing', folder: 'APIs' },
        { uid: '8', title: 'SSL Certificate Expiring', state: 'normal', folder: 'Security' },
      ];

      const suggestions: NormalSuggestion[] = [];
      const queryLower = query.toLowerCase();

      mockAlerts.forEach((alert) => {
        // Filter by firing state if filter is active
        if (filters?.firing && alert.state !== 'firing') {
          return;
        }

        // Filter by owner if filter is active
        // Note: Mock data doesn't have owner info, so we'll skip for now
        // In real implementation, you'd check: if (filters?.ownedByMe && alert.createdBy !== 'me') return;

        let score = 0;

        // Title match (highest weight)
        const titleLower = alert.title.toLowerCase();
        if (query) {
          if (titleLower === queryLower) {
            score += 100;
          } else if (titleLower.includes(queryLower)) {
            score += 50;
          } else if (titleLower.split(' ').some((word) => word.startsWith(queryLower))) {
            score += 30;
          }

          // Folder match
          if (alert.folder.toLowerCase().includes(queryLower)) {
            score += 20;
          }
        } else {
          // If no query, give base score so all items show
          score = 10;
        }

        // Firing alerts get priority
        if (alert.state === 'firing') {
          score += 15;
        }

        if (score > 0) {
          suggestions.push({
            uid: alert.uid,
            title: alert.title,
            state: alert.state,
            folder: alert.folder,
            score: score,
          });
        }
      });

      // Sort by score (highest first)
      suggestions.sort((a, b) => b.score - a.score);

      setNormalSuggestions(suggestions.slice(0, 4));
    } catch (err) {
      console.error('Failed to fetch alert suggestions:', err);
      setError('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

  const subtitle = useAI ? 'AI-powered recommendations' : 'Based on relevance and state';

  return (
    <Stack direction="column" gap={2}>
      <div className={styles.header}>
        <BrowsingSectionTitle title="Suggestions" subtitle={subtitle} icon="lightbulb" />

        {llmEnabled && (
          <div className={styles.switchContainer}>
            <Stack direction="row" gap={1} alignItems="center">
              <Icon name="search" className={styles.switchIcon} />
              <Switch value={useAI} onChange={(e) => setUseAI(e.currentTarget.checked)} />
              <Icon name="ai" className={useAI ? styles.switchIconActive : styles.switchIcon} />
            </Stack>
          </div>
        )}
      </div>

      {useAI ? (
        <AlertSearchAISuggestion searchQuery={query} filters={filters} />
      ) : (
        <div className={styles.normalSuggestions}>
          {loading && (
            <div className={styles.loadingState}>
              <Spinner />
              <Text>Finding suggestions...</Text>
            </div>
          )}

          {error && (
            <Card className={styles.errorCard}>
              <Text color="error">{error}</Text>
            </Card>
          )}

          {!loading && !error && normalSuggestions.length > 0 && (
            <Grid gap={2} columns={{ xs: 1, sm: 2 }}>
              {normalSuggestions.map((suggestion) => (
                <RecentVisitCard
                  key={suggestion.uid}
                  type="alert"
                  title={suggestion.title}
                  subtitle={`${suggestion.folder} • ${suggestion.state}`}
                  onClick={() => handleCardClick(suggestion.uid)}
                />
              ))}
            </Grid>
          )}

          {!loading && !error && normalSuggestions.length === 0 && (
            <Card className={styles.emptyCard}>
              <Stack direction="column" gap={2} alignItems="center">
                <Icon name="search" size="xxl" className={styles.emptyIcon} />
                <Text variant="h5">No suggestions found</Text>
                <Text color="secondary">Try a different search term</Text>
              </Stack>
            </Card>
          )}
        </div>
      )}
    </Stack>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  header: css({
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }),

  normalSuggestions: css({
    marginBottom: theme.spacing(2),
  }),

  loadingState: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing(4),
  }),

  errorCard: css({
    padding: theme.spacing(3),
    textAlign: 'center',
  }),

  emptyCard: css({
    padding: theme.spacing(4),
    textAlign: 'center',
    background: theme.colors.background.secondary,
  }),

  emptyIcon: css({
    color: theme.colors.text.secondary,
    opacity: 0.5,
  }),

  switchContainer: css({
    display: 'flex',
    alignItems: 'center',
  }),

  switchIcon: css({
    color: theme.colors.text.secondary,
    transition: 'color 0.2s ease',
  }),

  switchIconActive: css({
    color: theme.colors.primary.main,
    filter: 'drop-shadow(0 0 4px rgba(217, 70, 239, 0.5))',
    transition: 'all 0.2s ease',
  }),
});