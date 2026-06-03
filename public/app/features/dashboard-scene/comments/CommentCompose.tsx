import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { isAssistantAvailable } from '@grafana/assistant';
import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, useStyles2 } from '@grafana/ui';

import { CommentAssistantButton } from './CommentAssistantButton';
import { CommentReplyComposer } from './CommentReplyComposer';
import { type CommentAssistantPinContext } from './commentAssistant';

interface Props {
  x: number;
  y: number;
  pin: CommentAssistantPinContext;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

export function CommentCompose({ x, y, pin, onSubmit, onCancel }: Props) {
  const styles = useStyles2(getStyles);
  const [body, setBody] = useState('');
  const [mentionsEnabled, setMentionsEnabled] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const sub = isAssistantAvailable().subscribe(setMentionsEnabled);
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onCancel();
      }
    }
    document.addEventListener('mousedown', onDocMouseDown);
    return () => document.removeEventListener('mousedown', onDocMouseDown);
  }, [onCancel]);

  function submit() {
    const trimmed = body.trim();
    if (!trimmed) {
      onCancel();
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <div ref={ref} className={styles.popover} style={{ left: x, top: y }}>
      <CommentReplyComposer
        value={body}
        onChange={setBody}
        onSubmit={submit}
        mentionsEnabled={mentionsEnabled}
        rows={3}
        placeholder={t('dashboard-scene.comments-compose.placeholder', 'Add a comment…')}
        submitLabel={t('dashboard-scene.comments-compose.send', 'Comment')}
      />
      <div className={styles.actions}>
        <CommentAssistantButton
          pin={pin}
          origin="grafana/dashboard/comments/compose"
          className={styles.assistantButton}
        />
        <div className={styles.actionsSpacer} />
        <Button size="sm" variant="secondary" fill="text" onClick={onCancel}>
          {t('dashboard-scene.comments-compose.cancel', 'Cancel')}
        </Button>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  popover: css({
    position: 'fixed',
    transform: 'translate(0, 8px)',
    width: 320,
    padding: theme.spacing(2),
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    zIndex: 10001,
    pointerEvents: 'auto',
  }),
  actions: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    marginTop: theme.spacing(1.5),
  }),
  assistantButton: css({
    color: theme.colors.text.secondary,
  }),
  actionsSpacer: css({
    flex: 1,
  }),
});
