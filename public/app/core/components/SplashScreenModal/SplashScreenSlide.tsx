import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';
import { Badge, Icon, useStyles2, useTheme2 } from '@grafana/ui';

import { type SplashFeature } from './splashContent';

interface SplashScreenSlideProps {
  feature: SplashFeature;
  footer?: ReactNode;
}

export function SplashScreenSlide({ feature, footer }: SplashScreenSlideProps) {
  const theme = useTheme2();
  const accentColor = feature.accentColor(theme);
  const styles = useStyles2(getStyles, accentColor);
  const { alpha, darken } = colorManipulator;
  const gradient = `radial-gradient(ellipse at 80% 20%, ${alpha(accentColor, 0.51)} 0%, ${alpha(darken(accentColor, 0.3), 0.46)} 25%, ${alpha(darken(accentColor, 0.6), 0.4)} 40%, ${alpha(darken(accentColor, 0.85), 0.7)} 60%, rgba(23, 22, 38, 0.85) 75%, rgb(11, 15, 20) 100%)`;

  return (
    <div className={styles.slide}>
      <div
        className={styles.heroPanel}
        style={{
          background: `url(${feature.heroImageUrl}) center center / cover no-repeat, ${gradient}`,
        }}
      />
      <div className={styles.contentPanel}>
        <Badge text={feature.badge.text} icon={feature.badge.icon} color="green" className={styles.badge} />
        <h2 className={styles.title}>{feature.title}</h2>
        <div className={styles.body}>
          <div className={styles.iconBox}>
            <Icon name={feature.icon} size="xl" className={styles.iconBoxIcon} />
          </div>
          <p className={styles.subtitle}>{feature.subtitle}</p>
          <ul className={styles.bulletList}>
            {feature.bullets.map((bullet, i) => (
              <li key={i} className={styles.bulletItem}>
                <span className={styles.bulletDot} />
                <span className={styles.bulletText}>{bullet}</span>
              </li>
            ))}
          </ul>
        </div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2, accentColor: string) => ({
  slide: css({
    display: 'flex',
    height: '100%',
  }),
  heroPanel: css({
    flex: '0 0 45%',
    background: 'rgb(11, 15, 20)',
    borderRadius: `${theme.shape.radius.lg} 0 0 ${theme.shape.radius.lg}`,
    overflow: 'hidden',
  }),
  contentPanel: css({
    flex: '1 1 55%',
    padding: theme.spacing(4),
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    overflow: 'auto',
  }),
  badge: css({
    alignSelf: 'flex-start',
  }),
  title: css({
    fontSize: theme.typography.h3.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: theme.typography.h3.lineHeight,
    color: theme.colors.text.primary,
    margin: 0,
  }),
  body: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  subtitle: css({
    color: theme.colors.text.primary,
    fontSize: theme.typography.body.fontSize,
    lineHeight: theme.typography.body.lineHeight,
    fontWeight: theme.typography.fontWeightRegular,
    margin: 0,
  }),
  iconBox: css({
    width: 40,
    height: 40,
    borderRadius: theme.shape.radius.default,
    backgroundColor: colorManipulator.alpha(accentColor, 0.12),
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  iconBoxIcon: css({
    color: accentColor,
  }),
  bulletList: css({
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
  }),
  bulletItem: css({
    display: 'flex',
    alignItems: 'flex-start',
    gap: theme.spacing(1.5),
  }),
  bulletDot: css({
    width: 6,
    height: 6,
    minWidth: 6,
    borderRadius: theme.shape.radius.circle,
    backgroundColor: accentColor,
    // Vertically aligns the dot with the first line of text
    marginTop: theme.spacing(0.75),
  }),
  bulletText: css({
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: theme.typography.bodySmall.lineHeight,
  }),
  footer: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: theme.spacing(2),
  }),
});
