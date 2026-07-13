import { css, keyframes } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';

import { useStyles2 } from '../../themes/ThemeContext';
import { useBranding } from '../Branding/BrandingContext';

import grafanaIconSvg from './grafana_icon.svg';

export function BouncingLogo() {
  const styles = useStyles2(getStyles);
  const { AppLogo } = useBranding();

  // Use the branded logo supplied by the host app, falling back to the default Grafana icon.
  // This lets the loader pick up custom branding without the caller knowing.
  const logo = AppLogo ? <AppLogo /> : <img src={grafanaIconSvg} alt="Grafana" />;

  return (
    <div className={styles.bounce}>
      <div className={styles.logo}>{logo}</div>
    </div>
  );
}

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

    img: {
      width: '60px',
      height: '60px',
    },
  }),
});
