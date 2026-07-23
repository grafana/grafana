import { css } from '@emotion/css';

import { type GrafanaTheme2, type IconName } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

export interface LayoutModePillProps {
  icon: IconName;
  label: string;
  tooltip: string;
  onClick: () => void;
  className?: string;
  'data-testid'?: string;
}

/**
 * Compact pill that surfaces the active layout mode (Auto / Custom) at the scope where it applies.
 * Clicking it selects the container and opens its layout settings.
 */
export function LayoutModePill({ icon, label, tooltip, onClick, className, ...rest }: LayoutModePillProps) {
  const styles = useStyles2(getStyles);

  const activate = (evt: { preventDefault: () => void; stopPropagation: () => void }) => {
    // preventDefault also stops the surrounding tab anchor from navigating when the pill lives
    // inside a tab card; stopPropagation keeps clicks from starting a drag or toggling selection.
    evt.preventDefault();
    evt.stopPropagation();
    onClick();
  };

  return (
    <Tooltip content={tooltip}>
      {/* Rendered as a role=button span (not a <button>) so it is valid inside a tab's anchor. */}
      <span
        role="button"
        tabIndex={0}
        className={className ? `${styles.pill} ${className}` : styles.pill}
        data-testid={rest['data-testid']}
        onClick={activate}
        onKeyDown={(evt) => {
          if (evt.key === 'Enter' || evt.key === ' ') {
            activate(evt);
          }
        }}
        onPointerDown={(evt) => evt.stopPropagation()}
        onPointerUp={(evt) => evt.stopPropagation()}
      >
        <Icon name={icon} size="sm" />
        <span>{label}</span>
      </span>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  pill: css({
    display: 'inline-flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    height: theme.spacing(3),
    padding: theme.spacing(0, 1),
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.pill,
    background: theme.colors.background.secondary,
    color: theme.colors.text.secondary,
    ...theme.typography.bodySmall,
    lineHeight: 1,
    cursor: 'pointer',
    whiteSpace: 'nowrap',

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: theme.transitions.create(['background', 'color', 'border-color']),
    },

    '&:hover': {
      background: theme.colors.action.hover,
      color: theme.colors.text.primary,
      borderColor: theme.colors.border.medium,
    },

    '&:focus-visible': {
      outline: `2px solid ${theme.colors.primary.main}`,
      outlineOffset: '1px',
    },
  }),
});
