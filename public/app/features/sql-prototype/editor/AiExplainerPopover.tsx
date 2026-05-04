import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { Button, Input, Spinner, Text, useStyles2 } from '@grafana/ui';

import { askAiStream, getFollowUpResponse } from '../mocks/mockAi';

interface Props {
  selectedText: string;
  mode: 'explain' | 'generate';
  onClose: () => void;
  onInsert?: (sql: string) => void;
}

export function AiExplainerPopover({ selectedText, mode, onClose, onInsert }: Props) {
  const styles = useStyles2(getStyles);
  const [streamedText, setStreamedText] = useState('');
  const [isStreaming, setIsStreaming] = useState(true);
  const [followUpInput, setFollowUpInput] = useState('');
  const [followUpResponse, setFollowUpResponse] = useState('');
  const generatedSqlRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    setStreamedText('');
    setIsStreaming(true);
    generatedSqlRef.current = '';

    async function run() {
      const gen = askAiStream({ kind: mode === 'explain' ? 'explain' : 'generate', payload: selectedText });
      for await (const chunk of gen) {
        if (cancelled) {
          break;
        }
        setStreamedText((prev) => prev + chunk);
        if (mode === 'generate') {
          generatedSqlRef.current += chunk;
        }
      }
      if (!cancelled) {
        setIsStreaming(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [selectedText, mode]);

  const handleFollowUp = () => {
    if (!followUpInput.trim()) {
      return;
    }
    setFollowUpResponse(getFollowUpResponse(followUpInput));
    setFollowUpInput('');
  };

  const handleInsert = () => {
    if (onInsert && generatedSqlRef.current) {
      onInsert(generatedSqlRef.current);
    }
    onClose();
  };

  return (
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span className={styles.sparkle}>✨</span>
          <Text variant="h6">{mode === 'explain' ? 'AI Explanation' : 'AI Generate'}</Text>
          <button className={styles.closeBtn} onClick={onClose}>
            ×
          </button>
        </div>

        <div className={styles.snippet}>
          <Text variant="bodySmall" color="secondary">
            {mode === 'explain' ? 'Selected snippet:' : 'Generating from:'}
          </Text>
          <code className={styles.snipCode}>{selectedText.slice(0, 120)}{selectedText.length > 120 ? '…' : ''}</code>
        </div>

        <div className={styles.response}>
          {isStreaming && streamedText.length === 0 && <Spinner />}
          <Text variant="body">
            {streamedText}
            {isStreaming && <span className={styles.cursor}>▋</span>}
          </Text>
        </div>

        {!isStreaming && mode === 'generate' && (
          <div className={styles.actions}>
            <Button variant="primary" size="sm" onClick={handleInsert} icon="arrow-to-right">
              Insert at cursor
            </Button>
          </div>
        )}

        {!isStreaming && mode === 'explain' && (
          <div className={styles.followUp}>
            <Text variant="bodySmall" color="secondary">
              Ask a follow-up…
            </Text>
            <div className={styles.followUpRow}>
              <Input
                placeholder="e.g. why, how, alternative…"
                value={followUpInput}
                onChange={(e) => setFollowUpInput(e.currentTarget.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
              />
              <Button variant="secondary" size="sm" onClick={handleFollowUp}>
                Ask
              </Button>
            </div>
            {followUpResponse && (
              <div className={styles.followUpResponse}>
                <Text variant="bodySmall">{followUpResponse}</Text>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    backdrop: css({
      position: 'fixed',
      inset: 0,
      zIndex: theme.zIndex.modal,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    panel: css({
      background: theme.colors.background.primary,
      border: `1px solid ${theme.colors.border.medium}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(2),
      maxWidth: 560,
      width: '90%',
      maxHeight: '80vh',
      overflowY: 'auto',
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1.5),
      boxShadow: theme.shadows.z3,
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    sparkle: css({ fontSize: '18px' }),
    closeBtn: css({
      marginLeft: 'auto',
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      fontSize: '20px',
      color: theme.colors.text.secondary,
      lineHeight: 1,
    }),
    snippet: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    snipCode: css({
      fontFamily: theme.typography.fontFamilyMonospace,
      fontSize: theme.typography.bodySmall.fontSize,
      background: theme.colors.background.secondary,
      padding: theme.spacing(0.75, 1),
      borderRadius: theme.shape.radius.default,
      display: 'block',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    }),
    response: css({
      minHeight: 60,
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      whiteSpace: 'pre-wrap',
    }),
    cursor: css({
      display: 'inline-block',
      animation: 'blink 1s step-end infinite',
      '@keyframes blink': {
        '50%': { opacity: 0 },
      },
    }),
    actions: css({ display: 'flex', gap: theme.spacing(1) }),
    followUp: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    followUpRow: css({
      display: 'flex',
      gap: theme.spacing(1),
    }),
    followUpResponse: css({
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      borderLeft: `3px solid ${theme.colors.primary.border}`,
    }),
  };
}
