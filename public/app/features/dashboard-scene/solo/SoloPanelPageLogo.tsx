import { css, cx } from '@emotion/css';
import { useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { useStyles2, useTheme2 } from '@grafana/ui';
import grafanaTextLogoDarkSvg from 'img/grafana_text_logo_dark.svg';
import grafanaTextLogoLightSvg from 'img/grafana_text_logo_light.svg';

interface SoloPanelPageLogoProps {
  containerRef: React.RefObject<HTMLDivElement>;
  isHovered: boolean;
}

export function SoloPanelPageLogo({ containerRef, isHovered }: SoloPanelPageLogoProps) {
  const [scale, setScale] = useState(1);
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const grafanaLogo = theme.isDark ? grafanaTextLogoLightSvg : grafanaTextLogoDarkSvg;

  // Calculate responsive scale based on panel dimensions
  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) {
        return;
      }

      const { width, height } = containerRef.current.getBoundingClientRect();
      // Use the smaller dimension to ensure it scales appropriately for both wide and tall panels
      const minDimension = Math.min(width, height);

      // Base scale calculation: scale between 0.6 (for small panels ~200px) and 1.0 (for large panels ~800px+)
      // Allow scaling up to 1.0 for larger panels
      const baseScale = Math.max(0.6, Math.min(1.0, 0.6 + (minDimension - 200) / 600));

      // Also consider width specifically for very wide but short panels
      const widthScale = Math.max(0.6, Math.min(1.0, 0.6 + (width - 200) / 800));

      // Use the average of both for balanced scaling, ensuring we reach 1.0 for large panels
      const finalScale = Math.min(1.0, (baseScale + widthScale) / 2);
      setScale(finalScale);
    };

    updateScale();

    const resizeObserver = new ResizeObserver(updateScale);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => {
      resizeObserver.disconnect();
    };
  }, [containerRef]);

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
