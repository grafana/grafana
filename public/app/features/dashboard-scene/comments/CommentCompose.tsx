import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, TextArea, useStyles2 } from '@grafana/ui';

interface Props {
  x: number;
  y: number;
  onSubmit: (body: string) => void;
  onCancel: () => void;
}

export function CommentCompose({ x, y, onSubmit, onCancel }: Props) {
  const styles = useStyles2(getStyles);
  const [body, setBody] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textAreaRef.current?.focus();
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
      <TextArea
        ref={textAreaRef}
        value={body}
        onChange={(e) => setBody(e.currentTarget.value)}
        placeholder={t('dashboard-scene.comments-compose.placeholder', 'Add a comment…')}
        rows={3}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault();
            submit();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className={styles.actions}>
        <Button size="sm" variant="secondary" fill="text" onClick={onCancel}>
          {t('dashboard-scene.comments-compose.cancel', 'Cancel')}
        </Button>
        <Button size="sm" variant="primary" onClick={submit} disabled={!body.trim()}>
          {t('dashboard-scene.comments-compose.send', 'Comment')}
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
    justifyContent: 'flex-end',
    gap: theme.spacing(1),
    marginTop: theme.spacing(1.5),
  }),
});
