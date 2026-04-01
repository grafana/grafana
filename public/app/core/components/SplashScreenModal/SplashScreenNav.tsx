import { css, cx } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Button, Text, useStyles2 } from '@grafana/ui';

interface SplashScreenNavProps {
  activeIndex: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  onGoTo: (index: number) => void;
}

export function SplashScreenNav({ activeIndex, total, onPrev, onNext, onGoTo }: SplashScreenNavProps) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.nav}>
      <Button
        icon="angle-left"
        variant="secondary"
        fill="outline"
        size="sm"
        onClick={onPrev}
        aria-label={t('splash-screen.nav.prev', 'Previous')}
        className={styles.navButton}
      />
      <div className={styles.dots}>
        {Array.from({ length: total }, (_, i) => (
          <button
            key={i}
            className={cx(styles.dotBase, i === activeIndex ? styles.dotActive : styles.dotInactive)}
            onClick={() => onGoTo(i)}
            aria-label={t('splash-screen.nav.go-to', 'Go to slide {{number}}', { number: i + 1 })}
            aria-current={i === activeIndex ? 'step' : undefined}
          />
        ))}
      </div>
      <Button
        icon="angle-right"
        variant="secondary"
        fill="outline"
        size="sm"
        onClick={onNext}
        aria-label={t('splash-screen.nav.next', 'Next')}
        className={styles.navButton}
      />
      <Text color="secondary" variant="bodySmall">
        {activeIndex + 1}/{total}
      </Text>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  nav: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  navButton: css({
    width: theme.spacing(3),
    minWidth: theme.spacing(3),
    padding: 0,
    justifyContent: 'center',
  }),
  dots: css({
    display: 'flex',
    alignItems: 'center',
    // 5px gap matches design's 9px center-to-center dot spacing
    gap: 5,
  }),
  dotBase: css({
    borderRadius: theme.shape.radius.circle,
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  }),
  dotInactive: css({
    width: 4,
    height: 4,
    backgroundColor: theme.colors.text.disabled,
    opacity: 0.65,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: theme.transitions.create('background-color'),
    },
    '&:hover': {
      opacity: 1,
    },
  }),
  dotActive: css({
    width: 6,
    height: 6,
    backgroundColor: theme.colors.warning.text,
  }),
});
