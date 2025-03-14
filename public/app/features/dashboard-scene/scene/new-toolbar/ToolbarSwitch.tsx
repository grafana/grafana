import { css, cx } from '@emotion/css';
import { MouseEvent } from 'react';

import { GrafanaTheme2, IconName } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

interface Props {
  icon: IconName;
  label: string;
  checked: boolean;
  checkedIcon?: IconName;
  disabled?: boolean;
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
  'data-testId': dataTestId,
}: Props) => {
  const styles = useStyles2(getStyles);

  return (
    <Tooltip content={label}>
      <div
        aria-label={label}
        role="button"
        className={cx(styles.container, checked && styles.containerChecked, disabled && styles.containerDisabled)}
        data-testid={dataTestId}
        onClick={disabled ? undefined : onClick}
      >
        <div className={cx(styles.box, checked && styles.boxChecked)}>
          <Icon name={checked && checkedIcon ? checkedIcon : icon} />
        </div>
      </div>
    </Tooltip>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    border: `1px solid ${theme.colors.secondary.border}`,
    padding: theme.spacing(0.25),
    backgroundColor: theme.colors.secondary.main,
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
      backgroundColor: theme.colors.secondary.shade,
      borderColor: theme.colors.secondary.shade,
    },
  }),
  containerChecked: css({
    backgroundColor: theme.colors.primary.main,
    borderColor: theme.colors.primary.border,

    '&:hover': {
      backgroundColor: theme.colors.primary.shade,
      borderColor: theme.colors.primary.shade,
    },
  }),
  containerDisabled: css({
    cursor: 'initial',
  }),
  box: css({
    backgroundColor: theme.components.input.background,
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
    transform: `translateX(calc(100% - ${theme.spacing(0.25)}))`,
  }),
});
