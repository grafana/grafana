/* eslint-disable @grafana/i18n/no-untranslated-strings -- temporary scaffold page, not yet user-facing */
import { css, cx } from '@emotion/css';
import { useLayoutEffect } from 'react';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';

interface PageFallbackLoaderStep {
  id: string;
  label: string;
  done: boolean;
}

interface PageFallbackLoaderProps {
  steps?: PageFallbackLoaderStep[];
}

const DEFAULT_STEPS: PageFallbackLoaderStep[] = [
  { id: 'app', label: 'Loading ST pod', done: true },
  { id: 'data', label: 'Fetching data', done: false },
  { id: 'render', label: 'Rendering page', done: false },
];

export const PageFallbackLoader = ({ steps = DEFAULT_STEPS }: PageFallbackLoaderProps) => {
  const styles = useStyles2(getStyles);
  const activeIndex = steps.findIndex((step) => !step.done);
  const { chrome } = useGrafana();

  // Mirrors Page.tsx's chrome update, or the nav stays hidden on a cold load.
  // Side effect: breadcrumb flashes to "Home" until the real page mounts.
  useLayoutEffect(() => {
    chrome.update({});
  }, [chrome]);

  return (
    <div data-testid="page-fallback-loader" className={styles.wrapper}>
      <div className={styles.progressCard}>
        <ul className={styles.stepsList} aria-label="Page loading progress">
          {steps.map((step, index) => {
            const isActive = index === activeIndex;
            return (
              <li key={step.id} className={styles.stepItem}>
                <Icon
                  name={step.done ? 'check-circle' : isActive ? 'spinner' : 'circle-mono'}
                  size="sm"
                  className={cx(step.done && styles.iconDone, isActive && styles.iconActive)}
                />
                <span className={cx(!step.done && !isActive && styles.stepLabelPending)}>{step.label}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <PageBodySkeleton />
    </div>
  );
};

const PageBodySkeleton = () => {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid="page-fallback-skeleton" className={styles.grid}>
      <div className={styles.heroRow}>
        <Skeleton containerClassName={styles.heroPrimary} height="100%" />
        <Skeleton containerClassName={styles.heroSecondary} height="100%" />
        <Skeleton containerClassName={styles.heroSecondary} height="100%" />
      </div>
      <div className={styles.cardRow}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} containerClassName={styles.card} height="100%" />
        ))}
      </div>
      <div className={styles.cardRow}>
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} containerClassName={styles.card} height="100%" />
        ))}
      </div>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css({
    position: 'relative',
    padding: theme.spacing(2),
  }),
  progressCard: css({
    position: 'absolute',
    top: '5%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    zIndex: 1,
    padding: theme.spacing(1, 2),
    borderRadius: theme.shape.radius.lg,
    background: theme.colors.background.elevated,
    border: `1px solid ${theme.colors.border.weak}`,
    boxShadow: theme.shadows.z2,
  }),
  stepsList: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    listStyle: 'none',
    margin: 0,
    padding: 0,
  }),
  stepItem: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(1),
    fontSize: theme.typography.bodySmall.fontSize,
    color: theme.colors.text.primary,
    whiteSpace: 'nowrap',
  }),
  iconDone: css({
    color: theme.colors.success.text,
  }),
  iconActive: css({
    color: theme.colors.info.text,
  }),
  stepLabelPending: css({
    color: theme.colors.text.secondary,
  }),
  grid: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(2),
  }),
  heroRow: css({
    display: 'flex',
    width: '50%',
    gap: theme.spacing(2),
    height: 48,
  }),
  heroPrimary: css({
    display: 'block',
    flex: '2 1 0%',
    height: '100%',
  }),
  heroSecondary: css({
    display: 'block',
    flex: '1 1 0%',
    height: '100%',
  }),
  cardRow: css({
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: theme.spacing(2),
  }),
  card: css({
    display: 'block',
    width: '100%',
    aspectRatio: '1 / 2',
  }),
});
