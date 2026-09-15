/* eslint-disable @grafana/i18n/no-untranslated-strings -- temporary scaffold page, not yet user-facing */
import { css, cx } from '@emotion/css';
import Skeleton from 'react-loading-skeleton';

import { type GrafanaTheme2 } from '@grafana/data';
import { Icon, Stack, useStyles2 } from '@grafana/ui';

export interface PageFallbackLoaderStep {
  id: string;
  label: string;
  done: boolean;
}

export interface PageFallbackLoaderProps {
  steps?: PageFallbackLoaderStep[];
}

const DEFAULT_STEPS: PageFallbackLoaderStep[] = [
  { id: 'app', label: 'Loading application', done: true },
  { id: 'data', label: 'Fetching data', done: false },
  { id: 'render', label: 'Rendering page', done: false },
];

export const PageFallbackLoader = ({ steps = DEFAULT_STEPS }: PageFallbackLoaderProps) => {
  const styles = useStyles2(getStyles);
  const activeIndex = steps.findIndex((step) => !step.done);

  return (
    <div data-testid="page-fallback-loader">
      <ul className={styles.stepsRow} aria-label="Page loading progress">
        {steps.map((step, index) => {
          const isActive = index === activeIndex;
          return (
            <li key={step.id} className={cx(styles.pill, step.done && styles.pillDone, isActive && styles.pillActive)}>
              <Icon name={step.done ? 'check-circle' : isActive ? 'spinner' : 'circle-mono'} size="sm" />
              {step.label}
            </li>
          );
        })}
      </ul>
      <PageBodySkeleton />
    </div>
  );
};

const PageBodySkeleton = () => {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid="page-fallback-skeleton">
      <Stack direction="column" gap={3}>
        <Stack direction="row" justifyContent="space-between" alignItems="center">
          <Skeleton width={220} height={28} />
          <Stack direction="row" gap={1}>
            <Skeleton width={90} height={32} />
            <Skeleton width={90} height={32} />
          </Stack>
        </Stack>
        <Skeleton width={320} height={16} />
        <Stack direction="column" gap={2}>
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} height={64} containerClassName={styles.block} />
          ))}
        </Stack>
      </Stack>
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  stepsRow: css({
    display: 'flex',
    flexWrap: 'wrap',
    gap: theme.spacing(1),
    listStyle: 'none',
    margin: 0,
    marginBottom: theme.spacing(3),
    padding: 0,
  }),
  pill: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    borderRadius: theme.shape.radius.pill,
    padding: theme.spacing(0.5, 1.5),
    fontSize: theme.typography.bodySmall.fontSize,
    fontWeight: theme.typography.fontWeightMedium,
    lineHeight: theme.typography.bodySmall.lineHeight,
    color: theme.colors.text.secondary,
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.weak}`,
    whiteSpace: 'nowrap',
  }),
  pillActive: css({
    color: theme.colors.info.text,
    background: theme.colors.info.transparent,
    border: `1px solid ${theme.colors.info.border}`,
  }),
  pillDone: css({
    color: theme.colors.success.text,
    background: theme.colors.success.transparent,
    border: `1px solid ${theme.colors.success.border}`,
  }),
  block: css({
    display: 'block',
  }),
});
