// Prototype-only: canned demo strings; not i18n'd.
/* eslint-disable @grafana/i18n/no-untranslated-strings */
import { css } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../../themes/ThemeContext';
import { Icon } from '../../Icon/Icon';

import { QueryFlowPanel } from './QueryFlowPanel';

interface Props {
  /** Live editor container rect, used to anchor the flow panel. */
  getEditorRect: () => DOMRect | null;
  /** Dismiss the floating actions entirely. */
  onDismiss: () => void;
}

/**
 * Journey 3 — subtle, non-AI floating actions shown after a query is pasted.
 * "Explain query" / "Visualize" open a static query-flow breakdown; no LLM is
 * involved. The AI popover (/ + space) remains available on top.
 */
export function PasteActions({ getEditorRect, onDismiss }: Props) {
  const styles = useStyles2(getStyles);
  const [panelOpen, setPanelOpen] = useState(false);

  const anchor = () => {
    const rect = getEditorRect();
    return rect ? { top: rect.bottom + 8, left: rect.left } : { top: 120, left: 120 };
  };

  return (
    <>
      <div className={styles.bar}>
        <button className={styles.action} onClick={() => setPanelOpen(true)}>
          <Icon name="info-circle" size="sm" /> Explain query
        </button>
        <span className={styles.sep} />
        <button className={styles.action} onClick={() => setPanelOpen(true)}>
          <Icon name="code-branch" size="sm" /> Visualize
        </button>
        <button className={styles.close} onClick={onDismiss} aria-label="Dismiss">
          <Icon name="times-circle" size="sm" />
        </button>
      </div>

      {panelOpen && <QueryFlowPanel anchor={anchor()} onClose={() => setPanelOpen(false)} />}
    </>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  bar: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    background: theme.colors.background.elevated ?? theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.25),
    boxShadow: theme.shadows.z2,
    fontFamily: theme.typography.fontFamily,
    // subtle until hovered
    opacity: 0.85,
    '&:hover': { opacity: 1 },
  }),
  action: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
    background: 'transparent',
    border: 'none',
    borderRadius: theme.shape.radius.default,
    padding: theme.spacing(0.5, 1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
    },
  }),
  sep: css({
    width: 1,
    height: 16,
    background: theme.colors.border.weak,
  }),
  close: css({
    display: 'inline-flex',
    alignItems: 'center',
    background: 'transparent',
    border: 'none',
    padding: theme.spacing(0.5),
    color: theme.colors.text.secondary,
    cursor: 'pointer',
    '&:hover': { color: theme.colors.text.primary },
  }),
});
