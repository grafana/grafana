import { css, cx } from '@emotion/css';
import { useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { RadioButtonGroup, Text, useStyles2 } from '@grafana/ui';

type VizType = 'timeseries' | 'barchart' | 'stat' | 'gauge';
type DrawStyle = 'lines' | 'bars' | 'points';

const VIZ_TYPES: Array<{ id: VizType; label: string; icon: string }> = [
  { id: 'timeseries', label: 'Time series', icon: '📈' },
  { id: 'barchart', label: 'Bar chart', icon: '📊' },
  { id: 'stat', label: 'Stat', icon: '🔢' },
  { id: 'gauge', label: 'Gauge', icon: '🎯' },
];

const DRAW_STYLES: Array<{ label: string; value: DrawStyle }> = [
  { label: 'Lines', value: 'lines' },
  { label: 'Bars', value: 'bars' },
  { label: 'Points', value: 'points' },
];

export function VizOptionsPanel() {
  const styles = useStyles2(getStyles);
  const [vizType, setVizType] = useState<VizType>('timeseries');
  const [drawStyle, setDrawStyle] = useState<DrawStyle>('lines');

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text variant="bodySmall" weight="bold" color="secondary">
          VISUALIZATION
        </Text>
      </div>

      <div className={styles.section}>
        <Text variant="bodySmall" color="secondary">
          Panel type
        </Text>
        <div className={styles.vizGrid}>
          {VIZ_TYPES.map((v) => (
            <button
              key={v.id}
              className={cx(styles.vizCard, vizType === v.id && styles.vizCardActive)}
              onClick={() => setVizType(v.id)}
            >
              <span className={styles.vizIcon}>{v.icon}</span>
              <span className={styles.vizLabel}>{v.label}</span>
            </button>
          ))}
        </div>
      </div>

      {(vizType === 'timeseries' || vizType === 'barchart') && (
        <div className={styles.section}>
          <Text variant="bodySmall" color="secondary">
            Draw style
          </Text>
          <RadioButtonGroup options={DRAW_STYLES} value={drawStyle} onChange={setDrawStyle} size="sm" fullWidth />
        </div>
      )}

      <div className={styles.section}>
        <Text variant="bodySmall" color="secondary">
          Fill opacity
        </Text>
        <div className={styles.sliderRow}>
          <input type="range" min={0} max={100} defaultValue={0} className={styles.slider} />
        </div>
      </div>

      <div className={styles.section}>
        <Text variant="bodySmall" color="secondary">
          Line width
        </Text>
        <div className={styles.sliderRow}>
          <input type="range" min={1} max={10} defaultValue={2} className={styles.slider} />
        </div>
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    root: css({
      display: 'flex',
      flexDirection: 'column',
      height: '100%',
      background: theme.colors.background.primary,
      borderLeft: `1px solid ${theme.colors.border.weak}`,
      overflow: 'auto',
    }),
    header: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
      padding: theme.spacing(1.5, 2, 0.5),
    }),
    section: css({
      padding: theme.spacing(1, 2),
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
    }),
    vizGrid: css({
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: theme.spacing(1),
    }),
    vizCard: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: theme.spacing(0.5),
      padding: theme.spacing(1),
      background: theme.colors.background.secondary,
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      transition: 'border-color 0.15s, background 0.15s',
      '&:hover': {
        borderColor: theme.colors.border.medium,
      },
    }),
    vizCardActive: css({
      borderColor: theme.colors.primary.border,
      background: theme.colors.primary.transparent,
    }),
    vizIcon: css({
      fontSize: '20px',
      lineHeight: 1,
    }),
    vizLabel: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: theme.colors.text.secondary,
      textAlign: 'center',
    }),
    sliderRow: css({
      display: 'flex',
      alignItems: 'center',
      gap: theme.spacing(1),
    }),
    slider: css({
      flex: 1,
      accentColor: theme.colors.primary.main,
    }),
  };
}
