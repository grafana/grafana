import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

interface ColorScheme {
  id: string;
  label: string;
  swatches: string[];
}

const SCHEMES: ColorScheme[] = [
  {
    id: 'palette-classic',
    label: 'Classic',
    swatches: ['#5794F2', '#73BF69', '#B877D9', '#FF9830', '#F2495C'],
  },
  {
    id: 'continuous-blues',
    label: 'Cool',
    swatches: ['#5794F2', '#6E9FFF', '#19c0c0', '#73BF69', '#B877D9'],
  },
  {
    id: 'continuous-RdYlGr',
    label: 'Warm',
    swatches: ['#FF9830', '#F2495C', '#FADE2A', '#F55F3E', '#B877D9'],
  },
  {
    id: 'continuous-greys',
    label: 'Mono',
    swatches: ['#CCCCDC', 'rgba(204,204,220,0.7)', 'rgba(204,204,220,0.5)', 'rgba(204,204,220,0.35)', '#555'],
  },
];

interface Props {
  value: string;
  onChange: (value: string) => void;
}

export function PalettePicker({ value, onChange }: Props) {
  const styles = useStyles2(getStyles);
  const current = SCHEMES.find((s) => s.id === value) ?? SCHEMES[0];

  return (
    <div className={styles.wrap}>
      {/* Swatch preview bar */}
      <div className={styles.swatchBar}>
        {current.swatches.map((color, i) => (
          <div
            key={i}
            className={styles.swatch}
            style={{
              background: color,
              borderRadius: i === 0 ? `${2}px 0 0 ${2}px` : i === current.swatches.length - 1 ? `0 ${2}px ${2}px 0` : 0,
            }}
          />
        ))}
      </div>
      {/* Scheme buttons */}
      <div className={styles.schemeRow}>
        {SCHEMES.map((scheme) => (
          <button
            key={scheme.id}
            className={cx(styles.schemeBtn, value === scheme.id && styles.schemeBtnSelected)}
            onClick={() => onChange(scheme.id)}
            type="button"
          >
            {scheme.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrap: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.75),
      width: '100%',
    }),
    swatchBar: css({
      display: 'flex',
      height: 20,
      borderRadius: theme.shape.radius.default,
      overflow: 'hidden',
    }),
    swatch: css({
      flex: 1,
    }),
    schemeRow: css({
      display: 'flex',
      gap: theme.spacing(0.5),
      flexWrap: 'wrap',
    }),
    schemeBtn: css({
      background: 'transparent',
      border: `1px solid ${theme.colors.border.weak}`,
      borderRadius: theme.shape.radius.default,
      padding: theme.spacing(0.375, 0.75),
      fontSize: 11,
      color: theme.colors.text.primary,
      cursor: 'pointer',
      fontFamily: 'inherit',
      transition: 'border-color 120ms, background 120ms',
      ':hover': {
        background: theme.colors.action.hover,
      },
    }),
    schemeBtnSelected: css({
      background: theme.colors.action.selected,
      borderColor: theme.colors.border.strong,
    }),
  };
}
