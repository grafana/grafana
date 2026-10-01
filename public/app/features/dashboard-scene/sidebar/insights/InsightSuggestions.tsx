import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { useAssistant } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Stack, Text, useStyles2 } from '@grafana/ui';

import { type DashboardSceneLike } from '../../scene/types/dashboard';

import { type InsightSourcePanel } from './sources';
import { type InsightSuggestion, suggestInsightQuestions } from './suggestions';

interface Props {
  dashboard: DashboardSceneLike | undefined;
  sources: InsightSourcePanel[];
  /** Fills in the question and its source panels; the author can still edit both. */
  onPick: (suggestion: InsightSuggestion) => void;
}

interface SuggestionsState {
  loading: boolean;
  suggestions?: InsightSuggestion[];
  error?: string;
}

/** Suggests questions from the panels' titles and descriptions, so an author does not start from a blank box. */
export function InsightSuggestions({ dashboard, sources, onPick }: Props) {
  const styles = useStyles2(getStyles);
  const { isAvailable } = useAssistant();
  const [state, setState] = useState<SuggestionsState>({ loading: false });
  const request = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => request.current?.abort(), []);

  if (!isAvailable || !dashboard || sources.length === 0) {
    return null;
  }

  const suggest = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setState({ loading: true });
    try {
      const suggestions = await suggestInsightQuestions(dashboard, sources, controller.signal);
      if (!controller.signal.aborted) {
        setState({ loading: false, suggestions });
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        setState({ loading: false, error: error instanceof Error ? error.message : String(error) });
      }
    }
  };

  const titleFor = (key: string) => sources.find((source) => source.key === key)?.title ?? key;

  return (
    <Stack direction="column" gap={0.5} alignItems="start">
      <Button
        size="sm"
        variant="secondary"
        fill="text"
        icon={state.loading ? 'spinner' : 'ai-sparkle'}
        disabled={state.loading}
        onClick={suggest}
      >
        {state.suggestions
          ? t('dashboard.insights.suggestions.again', 'Suggest other questions')
          : t('dashboard.insights.suggestions.suggest', 'Suggest questions')}
      </Button>
      {state.error && (
        <Text variant="bodySmall" color="error">
          {state.error}
        </Text>
      )}
      {state.suggestions && (
        <ul className={styles.list} aria-label={t('dashboard.insights.suggestions.list-label', 'Suggested questions')}>
          {state.suggestions.map((suggestion) => (
            <li key={suggestion.question}>
              <button type="button" className={styles.suggestion} onClick={() => onPick(suggestion)}>
                <Text variant="bodySmall">{suggestion.question}</Text>
                <Text variant="bodySmall" color="secondary">
                  {suggestion.sourcePanelKeys.map(titleFor).join(' · ')}
                </Text>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Stack>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    list: css({
      listStyle: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      width: '100%',
    }),
    suggestion: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.25),
      width: '100%',
      padding: theme.spacing(0.75, 1),
      textAlign: 'left',
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      '&:hover': {
        borderColor: theme.colors.border.medium,
      },
      '&:focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: 1,
      },
    }),
  };
}
