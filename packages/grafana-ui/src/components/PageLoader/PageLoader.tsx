import { css, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';

import { useStyles2 } from '../../themes/ThemeContext';

import { BouncingLogo } from './BouncingLogo';

export function PageLoader() {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.loadingPage}>
      <div
        className={styles.container}
        aria-live="polite"
        role="status"
        aria-label={t('grafana-ui.page-loader.label', 'Loading')}
      >
        <BouncingLogo />
      </div>
    </div>
  );
}

const fadeIn = keyframes({
  '0%': {
    opacity: 0,
    animationTimingFunction: 'cubic-bezier(0, 0, 0.5, 1)',
  },
  '100%': {
    opacity: 1,
  },
});

const pulse = keyframes({
  '0%': {
    opacity: 0,
  },
  '50%': {
    opacity: 1,
  },
  '100%': {
    opacity: 0,
  },
});

const getStyles = (theme: GrafanaTheme2) => ({
  // TODO: In the future we will want to move the visual appearance - background and borders - up into core
  // Grafana and just have be a "full page loader" component.
  loadingPage: css(
    {
      backgroundColor: theme.colors.background.primary,
      flex: 1,
      flexDirection: 'column',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100%',
    },
    theme.flags.visualDesignRefresh && {
      backgroundColor: theme.colors.background.page,
      borderRadius: theme.shape.radius.lg,
      margin: theme.spacing(0, 0.5, 0.5, 0.5),
      border: `1px solid ${theme.colors.border.weak}`,
    }
  ),

  container: css({
    opacity: 0,
    [theme.transitions.handleMotion('no-preference')]: {
      animationName: fadeIn,
      animationIterationCount: 1,
      animationDuration: '0.9s',
      animationDelay: '0.5s',
      animationFillMode: 'forwards',
    },
    [theme.transitions.handleMotion('reduce')]: {
      animationName: pulse,
      animationIterationCount: 'infinite',
      animationDuration: '4s',
      animationDelay: '0.5s',
    },
  }),
});
