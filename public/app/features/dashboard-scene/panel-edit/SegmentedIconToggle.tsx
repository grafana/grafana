import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, type IconName, useStyles2 } from '@grafana/ui';

export interface SegmentedIconOption<T extends string = string> {
  value: T;
  label?: string;
  icon?: IconName;
  title?: string;
}

interface Props<T extends string> {
  value: T;
  options: Array<SegmentedIconOption<T>>;
  onChange: (value: T) => void;
  iconOnly?: boolean;
}

export function SegmentedIconToggle<T extends string>({ value, options, onChange, iconOnly = false }: Props<T>) {
  const styles = useStyles2(getStyles);
  return (
    <div className={styles.wrap} role="group">
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <button
            key={opt.value}
            title={opt.title ?? opt.label}
            aria-pressed={selected}
            className={cx(styles.btn, selected && styles.btnSelected)}
            onClick={() => onChange(opt.value)}
            type="button"
          >
            {opt.icon && <Icon name={opt.icon} size="sm" />}
            {!iconOnly && opt.label && <span>{opt.label}</span>}
          </button>
        );
      })}
    </div>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    wrap: css({
      display: 'flex',
      background: theme.colors.background.secondary,
      borderRadius: theme.shape.radius.default,
      padding: 2,
      gap: 2,
      width: '100%',
    }),
    btn: css({
      flex: 1,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing(0.5),
      height: 26,
      border: 'none',
      background: 'transparent',
      color: theme.colors.text.secondary,
      borderRadius: theme.shape.radius.default,
      cursor: 'pointer',
      fontSize: theme.typography.bodySmall.fontSize,
      fontFamily: 'inherit',
      padding: theme.spacing(0, 0.75),
      transition: 'background 120ms, color 120ms',
      ':hover': {
        background: theme.colors.action.hover,
        color: theme.colors.text.primary,
      },
      ':focus-visible': {
        outline: `2px solid ${theme.colors.primary.border}`,
        outlineOffset: '-2px',
      },
    }),
    btnSelected: css({
      background: theme.colors.action.selected,
      color: theme.colors.text.primary,
    }),
  };
}
