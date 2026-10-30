import { forEachDiagnostic, setDiagnosticsEffect } from '@codemirror/lint';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { css } from '@emotion/css';
import { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';

export interface OverviewRulerState {
  view: EditorView;
}

export function createOverviewRulerExtension(onChange: (editor: OverviewRulerState | null) => void) {
  return [
    EditorView.theme({ '.cm-scroller': { paddingRight: '24px' } }),
    ViewPlugin.define((view) => {
      onChange({ view });
      return {
        update(update) {
          if (
            update.docChanged ||
            update.geometryChanged ||
            update.transactions.some((transaction) =>
              transaction.effects.some((effect) => effect.is(setDiagnosticsEffect))
            )
          ) {
            onChange({ view });
          }
        },
        destroy() {
          onChange(null);
        },
      };
    }),
  ];
}

export function OverviewRuler({ editor }: { editor: OverviewRulerState }) {
  const styles = useStyles2(getStyles);
  const { view } = editor;
  const [bounds, setBounds] = useState({ top: 0, height: 0, right: 12 });

  useLayoutEffect(() => {
    let active = true;
    view.requestMeasure({
      read: () => {
        const editorBounds = view.dom.getBoundingClientRect();
        const scroller = view.scrollDOM.getBoundingClientRect();
        return {
          top: scroller.top - editorBounds.top + 4,
          height: Math.max(0, view.scrollDOM.clientHeight - 8),
          // Overlay scrollbars report zero width; leave room for them too.
          right:
            editorBounds.right - scroller.right + Math.max(12, view.scrollDOM.offsetWidth - view.scrollDOM.clientWidth),
        };
      },
      write: (bounds) => {
        if (active) {
          setBounds(bounds);
        }
      },
    });
    return () => {
      active = false;
    };
  }, [editor, view]);

  const { state } = view;
  const errors = new Map<number, { from: number; to: number; messages: string[] }>();
  forEachDiagnostic(state, (diagnostic, from, to) => {
    if (diagnostic.severity !== 'error') {
      return;
    }
    const line = state.doc.lineAt(from).number;
    const error = errors.get(line);
    if (error) {
      error.messages.push(diagnostic.message);
    } else {
      errors.set(line, { from, to, messages: [diagnostic.message] });
    }
  });

  if (errors.size === 0) {
    return null;
  }

  // Portal outside scrollDOM so off-screen errors stay visible while scrolling.
  return createPortal(
    <div
      className={styles.overview}
      role="group"
      aria-label={t('grafana-ui.code-mirror.overview-ruler', 'Errors')}
      style={bounds}
    >
      {Array.from(errors, ([line, { from, to, messages }]) => {
        const label = `${t('grafana-ui.code-mirror.overview-ruler-line', 'Line')} ${line}: ${messages.join('\n')}`;
        return (
          <button
            key={line}
            type="button"
            className={styles.marker}
            style={{ top: `${((line - 1) / Math.max(1, state.doc.lines - 1)) * 100}%` }}
            title={label}
            aria-label={label}
            onClick={() => {
              view.dispatch({
                selection: { anchor: from, head: to },
                effects: EditorView.scrollIntoView(from, { y: 'center' }),
              });
              view.focus();
            }}
          />
        );
      })}
    </div>,
    view.dom
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  overview: css({
    position: 'absolute',
    width: 12,
    pointerEvents: 'none',
  }),
  marker: css({
    position: 'absolute',
    left: 0,
    width: '100%',
    height: 8,
    padding: '2px 0',
    border: 0,
    background: 'transparent',
    transform: 'translateY(-50%)',
    cursor: 'pointer',
    pointerEvents: 'auto',
    '&::after': {
      content: '""',
      display: 'block',
      height: 4,
      background: theme.colors.error.main,
    },
    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: 1,
    },
  }),
});
