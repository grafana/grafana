import { css, cx } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';
import grafanaTextLogoDarkSvg from 'img/grafana_text_logo_dark.svg';
import grafanaTextLogoLightSvg from 'img/grafana_text_logo_light.svg';

interface SoloPanelPageLogoProps {
  scale: number;
  isHovered: boolean;
}

export function SoloPanelPageLogo({ scale, isHovered }: SoloPanelPageLogoProps) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const grafanaLogo = theme.isDark ? grafanaTextLogoLightSvg : grafanaTextLogoDarkSvg;

  return (
    <div
      className={cx(styles.logoContainer, isHovered && styles.logoHidden)}
      style={{
        fontSize: `${scale * 100}%`,
        top: `${8 * scale}px`,
        right: `${8 * scale}px`,
        padding: `${8 * scale}px ${8 * scale}px`,
      }}
    >
      <span className={styles.text}>
        <Trans i18nKey="embedded-panel.powered-by">Powered by</Trans>
      </span>
      <img
        src={grafanaLogo}
        alt="Grafana"
        className={styles.logo}
        style={{
          height: `${16 * scale}px`,
          marginLeft: `${0.5 * scale}em`,
        }}
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => {
  const logoContainer = css({
    position: 'absolute',
    // top, right, and padding will be set via inline styles for scaling
    backgroundColor: theme.colors.background.primary,
    borderRadius: theme.shape.radius.default,
    opacity: 0.9,
    pointerEvents: 'none',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    boxShadow: theme.shadows.z3,
    border: `1px solid ${theme.colors.border.weak}`,
    // Base font size - will be scaled via inline style
    fontSize: theme.typography.body.fontSize,
    lineHeight: 1.2,
    [theme.transitions.handleMotion('no-preference', 'reduce')]: {
      transition: 'opacity 0.2s ease-in-out',
    },
  });

  const logoHidden = css({
    opacity: 0,
  });

  const text = css({
    color: theme.colors.text.secondary,
    // fontSize will be inherited from parent container's scale
    lineHeight: 1.2,
    display: 'block',
  });

  const logo = css({
    // height will be set via inline style (16px * scale) to scale with panel size
    marginLeft: theme.spacing(0.5),
    display: 'block',
    flexShrink: 0,
  });

  return {
    logoContainer,
    logoHidden,
    text,
    logo,
  };
};
