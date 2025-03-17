import { css, cx } from '@emotion/css';
import { MouseEvent } from 'react';
import tinycolor2 from 'tinycolor2';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

interface Props {
  icon: IconName;
  label: string;
  checked: boolean;
  checkedIcon?: IconName;
  disabled?: boolean;
  variant: 'blue' | 'yellow' | 'gray';
  'data-testId'?: string;
  onClick: (evt: MouseEvent<HTMLDivElement>) => void;
}

export const ToolbarSwitch = ({
  icon,
  label,
  checked,
  checkedIcon,
  disabled,
  onClick,
  variant,
  'data-testId': dataTestId,
}: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Tooltip content={label}>
      <div
        aria-label={label}
        role="button"
        className={cx({
          [variant]: true,
          [styles.container]: true,
          [styles.containerChecked]: checked,
          [styles.containerDisabled]: disabled,
        })}
        data-testid={dataTestId}
        onClick={disabled ? undefined : onClick}
      >
        <div className={cx(styles.box, checked && styles.boxChecked)}>
          <Icon name={checked && checkedIcon ? checkedIcon : icon} size="xs" />
        </div>
      </div>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    border: `1px solid ${theme.components.input.borderColor}`,
    padding: theme.spacing(0.25),
    backgroundColor: theme.components.input.background,
    borderRadius: theme.shape.radius.default,
    width: theme.spacing(5.5),
    height: theme.spacing(3),
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'all 0.2s ease-in-out',
    },

    '&:hover': {
      borderColor: theme.components.input.borderHover,
    },
  }),
  containerChecked: css({
    '&.blue': {
      backgroundColor: theme.colors.primary.main,
      borderColor: theme.colors.primary.border,

      '&:hover': {
        backgroundColor: theme.colors.primary.shade,
        borderColor: theme.colors.primary.shade,
      },
    },

    '&.yellow': {
      backgroundColor: theme.colors.warning.main,
      borderColor: theme.colors.warning.border,

      '&:hover': {
        backgroundColor: theme.colors.warning.shade,
        borderColor: theme.colors.warning.shade,
      },
    },

    '&.gray': {
      backgroundColor: theme.colors.secondary.main,
      borderColor: theme.colors.secondary.border,

      '&:hover': {
        backgroundColor: theme.colors.secondary.shade,
        borderColor: theme.colors.secondary.shade,
      },
    },
  }),
  containerDisabled: css({
    cursor: 'initial',
    background: theme.colors.action.disabledBackground,
    borderColor: theme.colors.border.weak,
  }),
  box: css({
    backgroundColor: theme.isDark
      ? theme.colors.background.secondary
      : tinycolor2(theme.colors.background.secondary).darken(5).toRgbString(),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(2.5),
    height: theme.spacing(2.5),
    borderRadius: theme.shape.radius.default,
    transform: 'translateX(0)',

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'all 0.2s ease-in-out',
    },
  }),
  boxChecked: css({
    backgroundColor: theme.isDark
      ? tinycolor2(theme.colors.background.secondary).darken(5).toRgbString()
      : tinycolor2(theme.colors.background.secondary).lighten(5).toRgbString(),
    transform: `translateX(calc(100% - ${theme.spacing(0.25)}))`,
  }),
});
