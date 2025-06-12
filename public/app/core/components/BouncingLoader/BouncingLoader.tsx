import { css, keyframes } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { useStyles2 } from '@grafana/ui';
import grafanaIconSvg from 'img/grafana_icon.svg';

export function BouncingLoader() {
  const styles = useStyles2(getStyles);

  return (
    <div
      className={styles.container}
      aria-live="polite"
      role="status"
      aria-label={t('bouncing-loader.label', 'Loading')}
    >
      <div className={styles.bounce}>
        <img alt="" src={grafanaIconSvg} className={styles.logo} />
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

const bounce = keyframes({
  'from, to': {
    transform: 'translateY(0px)',
    animationTimingFunction: 'cubic-bezier(0.3, 0, 0.1, 1)',
  },
  '50%': {
    transform: 'translateY(-50px)',
    animationTimingFunction: 'cubic-bezier(0.9, 0, 0.7, 1)',
  },
});

const squash = keyframes({
  '0%': {
    transform: 'scaleX(1.3) scaleY(0.8)',
    animationTimingFunction: 'cubic-bezier(0.3, 0, 0.1, 1)',
  },
  '15%': {
    transform: 'scaleX(0.75) scaleY(1.25)',
    animationTimingFunction: 'cubic-bezier(0, 0, 0.7, 0.75)',
  },
  '55%': {
    transform: 'scaleX(1.05) scaleY(0.95)',
    animationTimingFunction: 'cubic-bezier(0.9, 0, 1, 1)',
  },
  '95%': {
    transform: 'scaleX(0.75) scaleY(1.25)',
    animationTimingFunction: 'cubic-bezier(0, 0, 0, 1)',
  },
  '100%': {
    transform: 'scaleX(1.3) scaleY(0.8)',
    animationTimingFunction: 'cubic-bezier(0, 0, 0.7, 1)',
  },
});

const getStyles = (theme: GrafanaTheme2) => ({
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

  bounce: css({
    textAlign: 'center',
    [theme.transitions.handleMotion('no-preference')]: {
      animationName: bounce,
      animationDuration: '0.9s',
      animationIterationCount: 'infinite',
    },
  }),

  logo: css({
    display: 'inline-block',
    [theme.transitions.handleMotion('no-preference')]: {
      animationName: squash,
      animationDuration: '0.9s',
      animationIterationCount: 'infinite',
    },
    width: '60px',
    height: '60px',
  }),
});
