import { css } from '@emotion/css';
import { useEffect, useState } from 'react';
import { useMeasure } from 'react-use';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Icon, LoadingBar, Spinner, Stack, Text, useStyles2 } from '@grafana/ui';

import { DEPLOY_INDEX, DETECTION_STEPS, type Hint, REQUEST_DURATION } from '../mockScenario';

import { AssistantIcon } from './AssistantIcon';
import { getAppNames } from './DrilldownInsights';

// Mock pacing: one signal every STEP_MS, then a short pause before the insights replace this view.
const STEP_MS = 700;
const DONE_PAUSE_MS = 600;
const GRAPH_HEIGHT = 120;

// The series as a 100 x 100 path, so the SVG can stretch to any width.
const GRAPH_MAX = Math.max(...REQUEST_DURATION) * 1.1;
const graphX = (index: number) => (index / (REQUEST_DURATION.length - 1)) * 100;
const GRAPH_PATH = REQUEST_DURATION.map(
  (value, index) => `${index === 0 ? 'M' : 'L'}${graphX(index)},${100 - (value / GRAPH_MAX) * 100}`
).join(' ');
const DEPLOY_X = (graphX(DEPLOY_INDEX - 1) + graphX(DEPLOY_INDEX)) / 2;

interface Props {
  hint: Hint;
  onDone: () => void;
}

export function DrilldownDetection({ hint, onDone }: Props) {
  const styles = useStyles2(getStyles);
  const appNames = getAppNames();
  const [measureRef, { width }] = useMeasure<HTMLDivElement>();
  const [checked, setChecked] = useState(0);
  // Starts at zero for one frame, so the line draws in from the left instead of appearing.
  const [started, setStarted] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setStarted(true));
    return () => cancelAnimationFrame(frame);
  }, []);
  // The line is drawn as far as the check in progress, and reaches the end with the last one.
  const progress = started ? Math.min((checked + 1) / DETECTION_STEPS.length, 1) : 0;

  useEffect(() => {
    if (checked < DETECTION_STEPS.length) {
      const timer = setTimeout(() => setChecked((count) => count + 1), STEP_MS);
      return () => clearTimeout(timer);
    }
    const timer = setTimeout(onDone, DONE_PAUSE_MS);
    return () => clearTimeout(timer);
  }, [checked, onDone]);

  return (
    <div className={styles.stage}>
      <section className={styles.panel} aria-live="polite">
        <div ref={measureRef} className={styles.bar}>
          {width > 0 && checked < DETECTION_STEPS.length && <LoadingBar width={width} />}
        </div>
        <Stack gap={1} alignItems="center">
          <AssistantIcon />
          <Text weight="medium">
            {t('drilldown-page.detection.title', 'Grafana Assistant is checking {{service}}', {
              service: hint.scope.value,
            })}
          </Text>
        </Stack>
        <div className={styles.body}>
          <ul className={styles.steps}>
            {DETECTION_STEPS.map((step, index) => {
              const state = index < checked ? 'done' : index === checked ? 'checking' : 'waiting';
              return (
                <li key={step.app} className={styles.step}>
                  <span className={styles.status}>
                    {state === 'done' && <Icon name="check" className={styles.done} />}
                    {state === 'checking' && <Spinner inline />}
                  </span>
                  <Text weight="medium" color={state === 'waiting' ? 'secondary' : 'primary'}>
                    {appNames[step.app]}
                  </Text>
                  <Text variant="bodySmall" color="secondary">
                    {state === 'done'
                      ? step.finding
                      : state === 'checking'
                        ? t('drilldown-page.detection.checking', 'Checking…')
                        : t('drilldown-page.detection.waiting', 'Waiting')}
                  </Text>
                </li>
              );
            })}
          </ul>
          <DetectionGraph service={hint.scope.value} progress={progress} />
        </div>
      </section>
    </div>
  );
}

// The signal behind the hint, drawn in as Grafana Assistant works through the checks, with the deploy marked.
function DetectionGraph({ service, progress }: { service: string; progress: number }) {
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.graph}>
      <Text variant="bodySmall" color="secondary">
        {t('drilldown-page.detection.graph-title', '{{service}} p95 latency', { service })}
      </Text>
      <div className={styles.plot}>
        <svg
          className={styles.svg}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden
          // Revealed from the left: a dash offset can't draw a path that is stretched to the container.
          style={{ clipPath: `inset(-4px ${(1 - progress) * 100}% -4px 0)` }}
        >
          <line className={styles.baseline} x1={0} y1={100} x2={100} y2={100} vectorEffect="non-scaling-stroke" />
          <path className={styles.line} d={GRAPH_PATH} vectorEffect="non-scaling-stroke" />
        </svg>
        <div className={styles.deploy} style={{ left: `${DEPLOY_X}%`, opacity: progress * 100 >= DEPLOY_X ? 1 : 0 }}>
          <Text variant="bodySmall" color="secondary">
            {t('drilldown-page.detection.graph-deploy', 'deploy v231')}
          </Text>
        </div>
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  body: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    alignItems: 'center',
    gap: theme.spacing(3),
    [theme.breakpoints.down('md')]: {
      gridTemplateColumns: '1fr',
    },
  }),
  graph: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    minWidth: 0,
  }),
  plot: css({
    position: 'relative',
    height: GRAPH_HEIGHT,
  }),
  svg: css({
    display: 'block',
    width: '100%',
    height: '100%',
    overflow: 'visible',
    [theme.transitions.handleMotion('no-preference')]: {
      transition: `clip-path ${STEP_MS}ms linear`,
    },
  }),
  baseline: css({
    stroke: theme.colors.border.weak,
    strokeWidth: 1,
  }),
  line: css({
    fill: 'none',
    stroke: theme.colors.error.main,
    strokeWidth: 2,
    strokeLinejoin: 'round',
  }),
  deploy: css({
    position: 'absolute',
    top: 0,
    bottom: 0,
    display: 'flex',
    alignItems: 'flex-start',
    paddingLeft: theme.spacing(0.5),
    borderLeft: `1px dashed ${theme.colors.text.secondary}`,
    [theme.transitions.handleMotion('no-preference')]: {
      transition: `opacity ${theme.transitions.duration.standard}ms ease-in`,
    },
  }),
  // The detection card is centered in the page while it runs; nothing else is on the page yet.
  stage: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '60vh',
  }),
  panel: css({
    position: 'relative',
    width: '100%',
    maxWidth: 960,
    margin: '0 auto',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1.5),
    padding: theme.spacing(2),
    overflow: 'hidden',
    background: theme.colors.background.primary,
    border: `1px solid ${theme.colors.border.weak}`,
    borderRadius: theme.shape.radius.default,
  }),
  bar: css({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
  }),
  steps: css({
    listStyle: 'none',
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(1),
    margin: 0,
    padding: 0,
  }),
  step: css({
    display: 'grid',
    gridTemplateColumns: `${theme.spacing(3)} 80px 1fr`,
    alignItems: 'center',
    gap: theme.spacing(1),
  }),
  status: css({
    display: 'flex',
    justifyContent: 'center',
  }),
  done: css({
    color: theme.colors.success.text,
  }),
});
