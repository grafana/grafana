import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Badge, Icon, useStyles2 } from '@grafana/ui';

import { type SplashFeature } from './splashContent';

interface SplashScreenSlideProps {
  feature: SplashFeature;
  footer?: ReactNode;
}

export function SplashScreenSlide({ feature, footer }: SplashScreenSlideProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.slide}>
      <div className={styles.heroPanel}>
        <img src={feature.heroImageUrl} alt="" className={styles.heroImage} />
      </div>
      <div className={styles.contentPanel}>
        <Badge text={t('splash-screen.badge', 'NEW FEATURE')} color="green" className={styles.badge} />
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

const getStyles = (theme: GrafanaTheme2) => ({
  slide: css({
    display: 'flex',
    height: '100%',
  }),
  heroPanel: css({
    flex: '0 0 45%',
    backgroundColor: theme.colors.background.canvas,
    borderRadius: `${theme.shape.radius.lg} 0 0 ${theme.shape.radius.lg}`,
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  heroImage: css({
    width: '100%',
    height: '100%',
    objectFit: 'cover',
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
    backgroundColor: theme.colors.warning.transparent,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  }),
  iconBoxIcon: css({
    color: theme.colors.warning.text,
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
    backgroundColor: theme.colors.warning.text,
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
