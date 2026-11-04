import { forEachDiagnostic, setDiagnosticsEffect } from '@codemirror/lint';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { css } from '@emotion/css';
import { useId, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';

import { EditorScrollbar } from './EditorScrollbar';

export interface OverviewRulerState {
  view: EditorView;
}

export function createOverviewRulerExtension(onChange: (editor: OverviewRulerState | null) => void) {
  return [
    EditorView.theme({
      '.cm-scroller': {
        marginRight: '12px',
        scrollbarWidth: 'none',
        '&::-webkit-scrollbar': { display: 'none' },
      },
      '.cm-scroller.cm-overview-ruler-horizontal': { marginBottom: '12px' },
    }),
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
  const scrollId = useId();
  const [bounds, setBounds] = useState({
    top: 0,
    left: 0,
    width: 0,
    height: 0,
    scrollWidth: 0,
    scrollHeight: 0,
    scrollTop: 0,
    scrollLeft: 0,
  });

  useLayoutEffect(() => {
    const scroller = view.scrollDOM;
    const previousId = scroller.id;
    scroller.setAttribute('id', previousId || scrollId);
    return () => {
      if (!previousId) {
        scroller.removeAttribute('id');
      }
      scroller.classList.remove('cm-overview-ruler-horizontal');
    };
  }, [view, scrollId]);

  useLayoutEffect(() => {
    let active = true;
    const scroller = view.scrollDOM;
    const measure = () =>
      view.requestMeasure({
        key: setBounds,
        read: () => {
          const editorBounds = view.dom.getBoundingClientRect();
          const scrollerBounds = scroller.getBoundingClientRect();
          return {
            top: scrollerBounds.top - editorBounds.top,
            left: scrollerBounds.left - editorBounds.left,
            width: scroller.clientWidth,
            height: scroller.clientHeight,
            scrollWidth: scroller.scrollWidth,
            scrollHeight: scroller.scrollHeight,
            scrollTop: scroller.scrollTop,
            scrollLeft: scroller.scrollLeft,
          };
        },
        write: (bounds) => {
          if (active) {
            scroller.classList.toggle('cm-overview-ruler-horizontal', bounds.scrollWidth > bounds.width);
            setBounds(bounds);
          }
        },
      });
    measure();
    scroller.addEventListener('scroll', measure);
    return () => {
      active = false;
      scroller.removeEventListener('scroll', measure);
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

  // Portal outside scrollDOM so off-screen errors stay visible while scrolling.
  return createPortal(
    <>
      <EditorScrollbar
        scroller={view.scrollDOM}
        orientation="vertical"
        top={bounds.top}
        left={bounds.left + bounds.width}
        size={bounds.height}
        contentSize={bounds.scrollHeight}
        position={bounds.scrollTop}
      >
        {errors.size > 0 && (
          <div
            className={styles.overview}
            role="group"
            aria-label={t('grafana-ui.code-mirror.overview-ruler', 'Errors')}
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
          </div>
        )}
      </EditorScrollbar>
      {bounds.scrollWidth > bounds.width && (
        <EditorScrollbar
          scroller={view.scrollDOM}
          orientation="horizontal"
          top={bounds.top + bounds.height}
          left={bounds.left}
          size={bounds.width}
          contentSize={bounds.scrollWidth}
          position={bounds.scrollLeft}
        />
      )}
    </>,
    view.dom
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  overview: css({
    position: 'absolute',
    top: 4,
    bottom: 4,
    width: '100%',
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
