import { forEachDiagnostic, setDiagnosticsEffect } from '@codemirror/lint';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { css, cx } from '@emotion/css';
import { useId, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';

import { EditorScrollbar, getScrollbarGeometry } from './EditorScrollbar';

const OVERVIEW_INSET = 4;

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
    markers: new Map<number, number>(),
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
          const height = scroller.clientHeight;
          const scrollHeight = scroller.scrollHeight;
          const { max, thumbSize, travel } = getScrollbarGeometry(height, scrollHeight);
          const markers = new Map<number, number>();
          forEachDiagnostic(view.state, (diagnostic, from) => {
            if (diagnostic.severity !== 'error') {
              return;
            }
            const block = view.lineBlockAt(from);
            const renderedTop = block.top + view.documentPadding.top;
            // Invert track-click positioning, including the minimum thumb size.
            const trackTop = max > 0 ? thumbSize / 2 + ((renderedTop - height / 2) / max) * travel : renderedTop;
            markers.set(
              block.from,
              Math.max(0, Math.min(Math.max(0, height - OVERVIEW_INSET * 2), trackTop - OVERVIEW_INSET))
            );
          });
          return {
            top: scrollerBounds.top - editorBounds.top,
            left: scrollerBounds.left - editorBounds.left,
            width: scroller.clientWidth,
            height,
            scrollWidth: scroller.scrollWidth,
            scrollHeight,
            scrollTop: scroller.scrollTop,
            scrollLeft: scroller.scrollLeft,
            markers,
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
        {bounds.markers.size > 0 && (
          <div className={cx('cm-overview-ruler', styles.overview)} aria-hidden="true">
            {Array.from(bounds.markers, ([from, top]) => (
              <div key={from} className={styles.marker} style={{ top }} />
            ))}
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
    top: OVERVIEW_INSET,
    bottom: OVERVIEW_INSET,
    width: '100%',
    pointerEvents: 'none',
  }),
  marker: css({
    position: 'absolute',
    left: 0,
    width: '100%',
    height: 4,
    background: theme.colors.error.main,
    transform: 'translateY(-50%)',
    pointerEvents: 'none',
  }),
});
