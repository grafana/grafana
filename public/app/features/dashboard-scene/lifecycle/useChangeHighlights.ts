import { css } from '@emotion/css';
import { useEffect } from 'react';

import { t } from '@grafana/i18n';
import { useTheme2 } from '@grafana/ui';

import { type DashboardScene } from '../scene/DashboardScene';

import { changedPanelKeys, type SpecChange } from './specDiff';

/**
 * Outlines the panels a fork adds or edits. Decorates the rendered panels by their
 * scene key instead of changing scene state, so highlighting never marks the dashboard dirty.
 */
export function useChangeHighlights(dashboard: DashboardScene, changes: SpecChange[] | undefined) {
  const theme = useTheme2();

  useEffect(() => {
    if (!changes || changes.length === 0) {
      return;
    }
    const keys = changedPanelKeys(changes);
    const highlight = (color: string, text: string) =>
      css({
        outline: `2px solid ${color}`,
        outlineOffset: -2,
        borderRadius: theme.shape.radius.default,
        position: 'relative',
        '&::after': {
          content: JSON.stringify(text),
          position: 'absolute',
          top: theme.spacing(0.75),
          right: theme.spacing(5),
          padding: theme.spacing(0, 0.75),
          borderRadius: theme.shape.radius.default,
          background: color,
          color: theme.colors.getContrastText(color),
          fontSize: theme.typography.bodySmall.fontSize,
          lineHeight: theme.typography.bodySmall.lineHeight,
          pointerEvents: 'none',
          zIndex: 1,
        },
      });
    const added = highlight(theme.colors.success.border, t('dashboard-scene.lifecycle.highlight-new', 'New'));
    const edited = highlight(theme.colors.warning.border, t('dashboard-scene.lifecycle.highlight-edited', 'Edited'));
    const decorate = () => {
      for (const [key, type] of keys) {
        const el = document.querySelector(`[data-viz-panel-key="${CSS.escape(key)}"]`);
        if (el) {
          el.classList.add(type === 'added' ? added : edited);
          el.setAttribute('data-lifecycle-change', type);
        }
      }
    };
    decorate();
    const observer = new MutationObserver(decorate);
    observer.observe(document.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      document.querySelectorAll('[data-lifecycle-change]').forEach((el) => {
        el.classList.remove(added, edited);
        el.removeAttribute('data-lifecycle-change');
      });
    };
  }, [dashboard, changes, theme]);
}
