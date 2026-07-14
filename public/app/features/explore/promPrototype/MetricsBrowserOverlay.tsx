// Prototype-only. Not internationalized.
// Floating overlay that shows the metric tree when the Option A rail is
// collapsed and the user clicks the metrics-browser icon. Click outside to
// dismiss; click a metric to insert + expand the rail.

import { css } from '@emotion/css';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { MetricTree } from './MetricTree';
import { type MockMetric } from './prometheusMockCatalog';

interface Props {
  anchor: DOMRect;
  filter: string;
  onFilterChange: (f: string) => void;
  onDismiss: () => void;
  onMetricClick: (metric: MockMetric) => void;
  onMetricAdd: (metric: MockMetric, anchor: DOMRect) => void;
  onLabelAdd: (metric: MockMetric, label: string, anchor: DOMRect) => void;
  onLabelExclude: (metric: MockMetric, label: string, anchor: DOMRect) => void;
  onValueAdd: (metric: MockMetric, label: string, value: string, anchor: DOMRect) => void;
  onValueExclude: (metric: MockMetric, label: string, value: string, anchor: DOMRect) => void;
}

export function MetricsBrowserOverlay({
  anchor,
  filter,
  onFilterChange,
  onDismiss,
  onMetricClick,
  onMetricAdd,
  onLabelAdd,
  onLabelExclude,
  onValueAdd,
  onValueExclude,
}: Props) {
  const styles = useStyles2(getStyles);
  const overlayRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const handler = (ev: MouseEvent) => {
      const target = ev.target as Node | null;
      if (!target) {
        return;
      }
      if (overlayRef.current?.contains(target)) {
        return;
      }
      onDismiss();
    };
    // Use `click` (not mousedown) so the click that opened us doesn't immediately close us.
    // The trigger button uses onClick which fires after mousedown/mouseup, so by the time
    // this listener sees a click, the current click has already been dispatched.
    const t = window.setTimeout(() => document.addEventListener('mousedown', handler), 0);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('mousedown', handler);
    };
  }, [onDismiss]);

  const style: React.CSSProperties = {
    top: anchor.top,
    left: anchor.right + 6,
    maxHeight: `calc(100vh - ${anchor.top + 24}px)`,
  };

  return createPortal(
    <div ref={overlayRef} className={styles.overlay} style={style} role="dialog" aria-label="Metrics browser">
      <div className={styles.sectionLabel}>Metrics</div>
      <MetricTree
        filter={filter}
        onFilterChange={onFilterChange}
        onMetricClick={onMetricClick}
        onMetricAdd={onMetricAdd}
        onLabelAdd={onLabelAdd}
        onLabelExclude={onLabelExclude}
        onValueAdd={onValueAdd}
        onValueExclude={onValueExclude}
      />
    </div>,
    document.body
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  overlay: css({
    position: 'fixed',
    zIndex: theme.zIndex.dropdown,
    width: 320,
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
    boxShadow: theme.shadows.z3,
    padding: theme.spacing(1),
    display: 'flex',
    flexDirection: 'column',
    minHeight: 0,
  }),
  sectionLabel: css({
    padding: theme.spacing(0.5, 0.5, 1),
    fontSize: theme.typography.size.sm,
    color: theme.colors.text.secondary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
});
