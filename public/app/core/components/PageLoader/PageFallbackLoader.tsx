import { css, keyframes } from '@emotion/css';
import { useLayoutEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom-v5-compat';

import { type GrafanaTheme2, PageLayoutType } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { Icon, Stack, Text, useStyles2 } from '@grafana/ui';
import { useGrafana } from 'app/core/context/GrafanaContext';
import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types/store';

import { Page } from '../Page/Page';

import { findNavItemForPath } from './navItemForPath';

// TODO: replace with a realistic P80 ST pod startup time once we have the data.
const PILL_FILL_DURATION_MS = 30_000;
const BLOB_ORBIT_LOOP_MS = 16_000;

const DOT_SIZE_PX = 1;
const DOT_PITCH_PX = 12;
const DOT_REVEAL_OPACITY = 0.26;

interface Blob {
  width: string;
  height: string;
}
const BLOBERTO: Blob = { width: 'clamp(800px, 120vw, 1800px)', height: 'clamp(580px, 90vw, 1335px)' };
const BLOBIGAIL: Blob = { width: 'clamp(720px, 108vw, 1620px)', height: 'clamp(615px, 98vw, 1440px)' };
const BLOBATHAN: Blob = { width: 'clamp(645px, 100vw, 1480px)', height: 'clamp(505px, 80vw, 1210px)' };
const BLOBS: readonly Blob[] = [BLOBERTO, BLOBIGAIL, BLOBATHAN];

const LEMNISCATE_WIDTH = 'clamp(480px, 80vw, 1280px)';
const LEMNISCATE_HEIGHT = 'clamp(260px, 44vw, 660px)';

interface PageFallbackLoaderStep {
  id: string;
  label: string;
  done: boolean;
}

interface PageFallbackLoaderProps {
  steps?: PageFallbackLoaderStep[];
}

export const PageFallbackLoader = ({ steps }: PageFallbackLoaderProps) => {
  const styles = useStyles2(getStyles);
  const { chrome } = useGrafana();
  const location = useLocation();
  const navTree = useSelector((state) => state.navBarTree);
  const navIndex = useSelector((state) => state.navIndex);

  const matchedNavItem = useMemo(
    () => findNavItemForPath(navTree, location.pathname, config.appSubUrl),
    [navTree, location.pathname]
  );
  const pageTitle = matchedNavItem?.text;

  useLayoutEffect(() => {
    const isIndexedNavItem = matchedNavItem?.id ? Boolean(navIndex[matchedNavItem.id]) : false;
    if (isIndexedNavItem && matchedNavItem?.id) {
      const navModel = getNavModel(navIndex, matchedNavItem.id);
      chrome.update({ sectionNav: navModel, pageNav: navModel.node });
    } else {
      chrome.update({});
    }
  }, [chrome, matchedNavItem, navIndex]);

  const resolvedSteps: PageFallbackLoaderStep[] = steps ?? [
    {
      id: 'preparing',
      label: pageTitle
        ? t('page-fallback-loader.step.preparing-named', 'Preparing {{pageTitle}}', { pageTitle })
        : t('page-fallback-loader.step.preparing', 'Preparing page'),
      done: false,
    },
  ];

  const activeIndex = resolvedSteps.findIndex((step) => !step.done);

  return (
    <Page layout={PageLayoutType.Custom}>
      <div data-testid="page-fallback-loader" className={styles.wrapper}>
        <DotFieldBackdrop />
        <div
          className={styles.progressPill}
          role="status"
          aria-live="polite"
          aria-label={t('page-fallback-loader.aria-label', 'Page loading progress')}
        >
          <div className={styles.progressFill} aria-hidden="true" />
          <ul className={styles.stepsList}>
            {resolvedSteps.map((step, index) => {
              const isActive = index === activeIndex;
              const isMuted = step.done || !isActive;
              return (
                <li key={step.id}>
                  <Stack direction="row" alignItems="center" gap={1}>
                    {step.done ? (
                      <Icon name="check-circle" size="sm" className={styles.iconDone} />
                    ) : (
                      <span className={styles.stepIndicatorRing} aria-hidden="true" />
                    )}
                    <Text variant="bodySmall" color={isMuted ? 'secondary' : 'primary'}>
                      {step.label}
                    </Text>
                  </Stack>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Page>
  );
};

const DotFieldBackdrop = () => {
  const styles = useStyles2(getStyles);

  return (
    <div data-testid="page-fallback-dotfield" className={styles.dotField} aria-hidden="true">
      <div className={styles.dotFieldReveal} />
    </div>
  );
};

// Lemniscate of Bernoulli:  x(t) = cos(t) / (1 + sin²(t)),  y(t) = sin(t)·cos(t) / (1 + sin²(t))
const LEMNISCATE_SAMPLE_COUNT = 16;
const LEMNISCATE_SAMPLES = Array.from({ length: LEMNISCATE_SAMPLE_COUNT }, (_, i) => {
  const t = (i / LEMNISCATE_SAMPLE_COUNT) * 2 * Math.PI;
  const denom = 1 + Math.sin(t) ** 2;
  return {
    x: Math.cos(t) / denom / 2,
    y: (Math.sin(t) * Math.cos(t)) / denom / 2,
  };
});
// Bloberto leads, Blobigail chases, Blobathan trails.
const BLOB_PHASE_OFFSETS = BLOBS.map((_, i) => Math.round((i * LEMNISCATE_SAMPLE_COUNT) / BLOBS.length));

const blobPositionsAt = (sample: number): string =>
  BLOB_PHASE_OFFSETS.map((offset) => {
    const { x, y } = LEMNISCATE_SAMPLES[(sample + offset) % LEMNISCATE_SAMPLE_COUNT];
    return `calc(50% + ${LEMNISCATE_WIDTH} * ${x}) calc(50% + ${LEMNISCATE_HEIGHT} * ${y})`;
  }).join(', ');

const blobOrbitMotion = keyframes(
  Object.fromEntries(
    Array.from({ length: LEMNISCATE_SAMPLE_COUNT + 1 }, (_, i) => {
      const position = blobPositionsAt(i % LEMNISCATE_SAMPLE_COUNT);
      return [`${(i / LEMNISCATE_SAMPLE_COUNT) * 100}%`, { maskPosition: position, WebkitMaskPosition: position }];
    })
  )
);

const pillFillAnimation = keyframes({
  from: { transform: 'translate3d(-100%, 0, 0)' },
  to: { transform: 'translate3d(0, 0, 0)' },
});

const getStyles = (theme: GrafanaTheme2) => {
  const dotPattern = (color: string) =>
    `radial-gradient(circle, ${color} ${DOT_SIZE_PX}px, transparent ${DOT_SIZE_PX + 0.5}px)`;

  const softEllipseGradient = `radial-gradient(ellipse closest-side, rgba(0,0,0,1) 0%, rgba(0,0,0,0.75) 15%, rgba(0,0,0,0.4) 30%, rgba(0,0,0,0.15) 42%, rgba(0,0,0,0) 50%)`;
  const blobMaskImage = BLOBS.map(() => softEllipseGradient).join(', ');
  const blobMaskSize = BLOBS.map(({ width, height }) => `${width} ${height}`).join(', ');
  const blobInitialPosition = blobPositionsAt(0);

  return {
    wrapper: css({
      position: 'relative',
      width: '100%',
      height: '100%',
      minHeight: '60vh',
      overflow: 'hidden',
    }),
    dotField: css({
      position: 'absolute',
      inset: 0,
      pointerEvents: 'none',
    }),
    dotFieldReveal: css({
      position: 'absolute',
      inset: 0,
      backgroundImage: dotPattern(theme.colors.text.primary),
      backgroundSize: `${DOT_PITCH_PX}px ${DOT_PITCH_PX}px`,
      backgroundPosition: 'center',
      opacity: DOT_REVEAL_OPACITY,
      maskImage: blobMaskImage,
      WebkitMaskImage: blobMaskImage,
      maskRepeat: 'no-repeat',
      WebkitMaskRepeat: 'no-repeat',
      maskSize: blobMaskSize,
      WebkitMaskSize: blobMaskSize,
      maskPosition: blobInitialPosition,
      WebkitMaskPosition: blobInitialPosition,
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${blobOrbitMotion} ${BLOB_ORBIT_LOOP_MS}ms linear infinite`,
      },
    }),
    progressPill: css({
      position: 'absolute',
      top: theme.spacing(4),
      left: '50%',
      transform: 'translateX(-50%)',
      zIndex: 1,
      padding: theme.spacing(1, 2),
      borderRadius: theme.shape.radius.pill,
      background: theme.colors.background.elevated,
      border: `1px solid ${theme.colors.border.weak}`,
      boxShadow: theme.shadows.z2,
      overflow: 'hidden',
      isolation: 'isolate',
    }),
    progressFill: css({
      position: 'absolute',
      inset: 0,
      background: theme.colors.action.hover,
      pointerEvents: 'none',
      zIndex: -1,
      transform: 'translate3d(-100%, 0, 0)',
      willChange: 'transform',
      [theme.transitions.handleMotion('no-preference')]: {
        animation: `${pillFillAnimation} ${PILL_FILL_DURATION_MS}ms linear forwards`,
      },
    }),
    stepsList: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
      listStyle: 'none',
      margin: 0,
      padding: 0,
      whiteSpace: 'nowrap',
    }),
    iconDone: css({
      color: theme.colors.success.text,
    }),
    stepIndicatorRing: css({
      display: 'inline-block',
      width: 14,
      height: 14,
      borderRadius: theme.shape.radius.circle,
      border: `1.5px solid ${theme.colors.text.primary}`,
      boxSizing: 'border-box',
    }),
  };
};
