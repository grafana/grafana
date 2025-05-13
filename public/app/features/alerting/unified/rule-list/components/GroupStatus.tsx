import { css, keyframes } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';
import { t } from 'app/core/internationalization';

interface GroupStatusProps {
  status: 'deleting'; // We don't support other statuses yet
}

export function GroupStatus({ status }: GroupStatusProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <div className={styles.loader} />
      {status === 'deleting' && (
        <Tooltip content={t('alerting.group-status.content-the-group-is-being-deleted', 'The group is being deleted')}>
          <div className={styles.iconWrapper}>
            <Icon name="trash-alt" size="sm" />
          </div>
        </Tooltip>
      )}
    </div>
  );
}

const rotation = keyframes({
  '0%': {
    transform: 'rotate(0deg)',
  },
  '100%': {
    transform: 'rotate(360deg)',
  },
});

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: theme.spacing(0.5),
  }),

  loader: css({
    position: 'absolute',
    inset: `-${theme.spacing(0.5)}`,
    border: '2px solid #FFF',
    borderRadius: theme.shape.radius.circle,
    boxSizing: 'border-box',
    [theme.transitions.handleMotion('no-preference')]: {
      animationName: rotation,
      animationIterationCount: 'infinite',
      animationDuration: '1s',
      animationTimingFunction: 'linear',
    },

    '&::after': {
      content: '""',
      boxSizing: 'border-box',
      position: 'absolute',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: 'calc(100% + 4px)',
      height: 'calc(100% + 4px)',
      borderRadius: theme.shape.radius.circle,
      border: '2px solid transparent',
      borderBottomColor: theme.colors.action.selectedBorder,
    },
  }),

  iconWrapper: css({
    position: 'relative',
    zIndex: 1,
    display: 'flex',
  }),

  '@keyframes rotation': {
    '0%': {
      transform: 'rotate(0deg)',
    },
    '100%': {
      transform: 'rotate(360deg)',
    },
  },
});
