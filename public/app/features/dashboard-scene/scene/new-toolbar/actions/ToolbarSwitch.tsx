import { css, cx } from '@emotion/css';
import { MouseEvent } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

interface Props {
  icon: IconName;
  label: string;
  checked: boolean;
  checkedIcon?: IconName;
  checkedLabel?: string;
  disabled?: boolean;
  'data-testid'?: string;
  onClick: (evt: MouseEvent<HTMLButtonElement>) => void;
}

export const ToolbarSwitch = ({
  icon,
  label,
  checked,
  checkedIcon,
  checkedLabel,
  disabled,
  onClick,
  'data-testid': dataTestId,
}: Props) => {
  const styles = useStyles2(getStyles);

  const labelText = checked && checkedLabel ? checkedLabel : label;
  const iconName = checked && checkedIcon ? checkedIcon : icon;

  return (
    <Tooltip content={labelText}>
      <button
        aria-label={labelText}
        className={cx({
          [styles.container]: true,
          [styles.containerChecked]: checked,
          [styles.containerDisabled]: disabled,
        })}
        data-testid={dataTestId}
        onClick={disabled ? undefined : onClick}
      >
        <div className={cx(styles.box, checked && styles.boxChecked)}>
          <Icon name={iconName} size="xs" />
        </div>
      </button>
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
    backgroundColor: theme.colors.primary.main,
    borderColor: 'transparent',

    '&:hover': {
      backgroundColor: theme.colors.primary.shade,
      borderColor: 'transparent',
    },
  }),
  containerDisabled: css({
    cursor: 'initial',
    background: theme.colors.action.disabledBackground,
    borderColor: theme.colors.border.weak,
  }),
  box: css({
    background: theme.colors.background.primary,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: theme.spacing(2.5),
    height: theme.spacing(2.5),
    borderRadius: theme.shape.radius.default,
    transform: 'translateX(0)',
    position: 'relative',

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'all 0.2s ease-in-out',
    },

    '&:after': css({
      content: "''",
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      borderRadius: theme.shape.radius.default,
      background: theme.colors.secondary.main,
      border: `1px solid ${theme.colors.secondary.border}`,
    }),
  }),
  boxChecked: css({
    transform: `translateX(calc(100% - ${theme.spacing(0.25)}))`,
  }),
});
