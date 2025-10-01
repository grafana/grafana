import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Card, Grid, Icon, Spinner, Stack, Switch, Text, useStyles2 } from '@grafana/ui';
import { BrowsingSectionTitle } from 'app/features/browse-dashboards/hackathon14/BrowsingSectionTitle';
import { RecentVisitCard } from 'app/features/browse-dashboards/hackathon14/RecentVisitCard';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

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

  const fetchNormalSuggestions = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Mock alert rules search - in a real implementation, this would call an API
      const mockAlerts = [
        {
          uid: '1',
          title: t('alerting.hackathon.mock.high-cpu', 'High CPU Usage Alert'),
          state: 'firing',
          folder: t('alerting.hackathon.mock.production', 'Production'),
        },
      ];

      const suggestions: NormalSuggestion[] = [];
      const queryLower = query.toLowerCase();

      mockAlerts.forEach((alert) => {
        if (filters?.firing && alert.state !== 'firing') {
          return;
        }
        let score = 0;
        const titleLower = alert.title.toLowerCase();
        if (query) {
          if (titleLower === queryLower) {
            score += 100;
          } else if (titleLower.includes(queryLower)) {
            score += 50;
          }
        } else {
          score = 10;
        }
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

      suggestions.sort((a, b) => b.score - a.score);

      setNormalSuggestions(suggestions.slice(0, 4));
    } catch (err) {
      console.error('Failed to fetch alert suggestions:', err);
      setError(t('alerting.hackathon.suggestions.failed', 'Failed to load suggestions'));
    } finally {
      setLoading(false);
    }
  }, [filters?.firing, query]);

  useEffect(() => {
    if (!useAI && hasActiveFilters) {
      fetchNormalSuggestions();
    }
  }, [query, useAI, filters?.firing, filters?.ownedByMe, hasActiveFilters, fetchNormalSuggestions]);

  

  const handleCardClick = (uid: string) => {
    window.location.href = `/alerting/grafana/${uid}/view`;
  };

  // If there are no suggestions to show and not loading, hide the section entirely
  if (!useAI && !loading && !error && normalSuggestions.length === 0) {
    return null;
  }

  const subtitle = useAI
    ? t('alerting.hackathon.suggestions.ai-subtitle', 'AI-powered recommendations')
    : t('alerting.hackathon.suggestions.subtitle', 'Based on relevance and state');

  return (
    <Stack direction="column" gap={2}>
      <div className={styles.header}>
        <BrowsingSectionTitle
          title={t('alerting.hackathon.suggestions.title', 'Suggestions')}
          subtitle={subtitle}
          icon="bell"
        />

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
              <Text>
                <Trans i18nKey="alerting.hackathon.suggestions.finding">Finding suggestions...</Trans>
              </Text>
            </div>
          )}

          {error && (
            <Card noMargin className={styles.errorCard}>
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
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'color 0.2s ease',
    },
  }),

  switchIconActive: css({
    color: theme.colors.primary.main,
    filter: 'drop-shadow(0 0 4px rgba(217, 70, 239, 0.5))',
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'all 0.2s ease',
    },
  }),
});
