import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, Tooltip, useStyles2 } from '@grafana/ui';

export const ConditionalRenderingOverlay = () => {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      <Tooltip
        content={t(
          'dashboard.conditional-rendering.overlay.tooltip',
          'Element is hidden due to conditional rendering.'
        )}
      >
        <Icon name="eye-slash" />
      </Tooltip>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'absolute',
    width: '100%',
    height: '100%',
    bottom: 0,
    right: 0,
    zIndex: 1,

    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'all 0.2s ease',
    },

    '&:before': css({
      content: '""',
      opacity: 0.6,
      position: 'absolute',
      width: '100%',
      height: '100%',
      top: 0,
      left: 0,
      backgroundColor: theme.colors.background.canvas,
      pointerEvents: 'none',
    }),

    '& > svg': css({
      height: '48px',
      width: '48px',
      maxWidth: '75%',
      maxHeight: '75%',
    }),

    '.dashboard-visible-hidden-element:hover > &': css({
      width: '30px',
      height: '30px',
      top: 'unset',
      left: 'unset',
      right: 0,
      bottom: 0,
    }),
  }),
});
