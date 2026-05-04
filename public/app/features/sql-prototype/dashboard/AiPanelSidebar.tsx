import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Input, Spinner, Text, useStyles2 } from '@grafana/ui';

import { SUGGESTED_FOLLOW_UPS, askAiStream, getFollowUpResponse } from '../mocks/mockAi';

interface Props {
  panelTitle: string;
}

export function AiPanelSidebar({ panelTitle }: Props) {
  const styles = useStyles2(getStyles);
  const [input, setInput] = useState('');
  const [answer, setAnswer] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [hasAnswered, setHasAnswered] = useState(false);

  const handleAsk = async (question?: string) => {
    const q = question ?? input;
    if (!q.trim()) {
      return;
    }
    setIsLoading(true);
    setAnswer('');
    setHasAnswered(false);

    let text = '';
    const gen = askAiStream({
      kind: 'panel-question',
      payload: `${panelTitle}: ${q}`,
    });
    for await (const chunk of gen) {
      text += chunk;
      setAnswer(text);
    }
    setIsLoading(false);
    setHasAnswered(true);
    setInput('');
  };

  const handleChipClick = (chip: string) => {
    setInput('');
    if (hasAnswered) {
      setAnswer(getFollowUpResponse(chip));
    } else {
      handleAsk(chip);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <span className={styles.sparkle}>✨</span>
        <Text variant="bodySmall" weight="bold">
          Ask AI
        </Text>
      </div>

      <div className={styles.inputRow}>
        <Input
          placeholder="Ask a question about this panel's data"
          value={input}
          onChange={(e) => setInput(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAsk()}
          disabled={isLoading}
        />
        <Button size="sm" variant="primary" onClick={() => handleAsk()} disabled={isLoading || !input.trim()}>
          Ask
        </Button>
      </div>

      {isLoading && (
        <div className={styles.loading}>
          <Spinner size="sm" />
          <Text variant="bodySmall" color="secondary">
            Analyzing data…
          </Text>
        </div>
      )}

      {!isLoading && answer && (
        <div className={styles.answer}>
          <Text variant="bodySmall">{answer}</Text>
        </div>
      )}

      <div className={styles.chips}>
        {SUGGESTED_FOLLOW_UPS.map((chip) => (
          <button key={chip} className={styles.chip} onClick={() => handleChipClick(chip)}>
            {chip}
          </button>
        ))}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      padding: theme.spacing(1.5),
      borderBottom: `1px solid ${theme.colors.border.medium}`,
      background: `linear-gradient(135deg, rgba(120,80,200,0.06), transparent)`,
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.5),
    }),
    sparkle: css({ fontSize: '14px' }),
    inputRow: css({
      display: 'flex',
      gap: theme.spacing(0.75),
    }),
    loading: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(0.75),
    }),
    answer: css({
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      borderLeft: `3px solid ${theme.colors.primary.border}`,
    }),
    chips: css({
      display: 'flex',
      flexWrap: 'wrap',
      gap: theme.spacing(0.5),
    }),
    chip: css({
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.pill,
      padding: theme.spacing(0.25, 1),
      fontSize: theme.typography.bodySmall.fontSize,
      cursor: 'pointer',
      color: theme.colors.text.secondary,
      '&:hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
        borderColor: theme.colors.border.strong,
      },
    }),
  };
}
