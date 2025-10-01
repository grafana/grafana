import { css } from '@emotion/css';
import { useState, useEffect } from 'react';
import { useAsync } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Card, Stack, Text, useStyles2, Icon, Spinner, Grid, Switch } from '@grafana/ui';
import { getGrafanaSearcher } from 'app/features/search/service/searcher';
import { isLLMPluginEnabled } from 'app/features/dashboard/components/GenAI/utils';

import { BrowsingSectionTitle } from './BrowsingSectionTitle';
import { SearchResultAIRecommendation } from './SearchResultAIRecommendation';
import { RecentVisitCard } from './RecentVisitCard';

interface NormalSuggestion {
  uid: string;
  title: string;
  kind: string;
  url: string;
  tags?: string[];
  visitCount?: number;
  score: number;
}

export const SearchResultSuggestion = ({ searchQuery }: { searchQuery: string }) => {
  const styles = useStyles2(getStyles);
  const [useAI, setUseAI] = useState(false);
  const [normalSuggestions, setNormalSuggestions] = useState<NormalSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Check if LLM plugin is enabled
  const { value: llmEnabled } = useAsync(async () => {
    return await isLLMPluginEnabled();
  }, []);

  useEffect(() => {
    if (!useAI && searchQuery) {
      fetchNormalSuggestions();
    }
  }, [searchQuery, useAI]);

  const fetchNormalSuggestions = async () => {
    setLoading(true);
    setError(null);

    try {
      const searcher = getGrafanaSearcher();
      
      // Search for dashboards and folders matching the query
      const result = await searcher.search({
        query: searchQuery,
        kind: ['dashboard', 'folder'],
        limit: 8,
      });

      const suggestions: NormalSuggestion[] = [];
      const view = result.view;

      for (let i = 0; i < view.length; i++) {
        const item = view.get(i);
        
        // Calculate relevance score based on multiple factors
        let score = 0;
        
        // Title match (highest weight)
        const titleLower = item.name?.toLowerCase() || '';
        const queryLower = searchQuery.toLowerCase();
        
        if (titleLower === queryLower) {
          score += 100;
        } else if (titleLower.includes(queryLower)) {
          score += 50;
        } else if (titleLower.split(' ').some((word: string) => word.startsWith(queryLower))) {
          score += 30;
        }
        
        // Tag match
        if (item.tags && Array.isArray(item.tags)) {
          const matchedTags = item.tags.filter((tag: string) => 
            tag.toLowerCase().includes(queryLower)
          );
          score += matchedTags.length * 20;
        }
        
        // Location/folder match
        if (item.location && item.location.toLowerCase().includes(queryLower)) {
          score += 15;
        }

        suggestions.push({
          uid: item.uid,
          title: item.name,
          kind: item.kind,
          url: item.url,
          tags: item.tags,
          score: score,
        });
      }

      // Sort by score (highest first)
      suggestions.sort((a, b) => b.score - a.score);
      
      setNormalSuggestions(suggestions.slice(0, 4));
    } catch (err) {
      console.error('Failed to fetch normal suggestions:', err);
      setError('Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  };

  const handleCardClick = (url: string) => {
    if (url) {
      window.location.href = url;
    }
  };

  const subtitle = useAI ? 'AI-powered recommendations' : 'Based on relevance and popularity';

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
        <SearchResultAIRecommendation searchQuery={searchQuery} />
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
                  type={suggestion.kind as 'dashboard' | 'folder'}
                  title={suggestion.title}
                  subtitle={suggestion.tags?.join(', ') || 'No tags'}
                  onClick={() => handleCardClick(suggestion.url)}
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
    // marginBottom: theme.spacing(2),
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
