import { css } from '@emotion/css';
import { useMemo } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

// Deterministic pseudo-random walk so the mock chart looks like the Figma
// screenshots and never changes between renders.
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Props {
  color?: string;
}

const POINTS = 240;
const MIN = 34;
const MAX = 47;

export function MockChart({ color }: Props) {
  const styles = useStyles2(getStyles);

  const series = useMemo(() => {
    const rand = mulberry32(42);
    const out: number[] = [];
    let v = 41;
    for (let i = 0; i < POINTS; i++) {
      v += (rand() - 0.48) * 1.6;
      // gentle sinusoidal drift so it dips mid-range like the mock
      v += Math.sin(i / 26) * 0.12 - Math.sin(i / 7) * 0.05;
      v = Math.max(MIN + 0.5, Math.min(MAX - 0.5, v));
      out.push(v);
    }
    return out;
  }, []);

  const w = 1000;
  const h = 260;
  const padL = 26;
  const padR = 8;
  const padT = 8;
  const padB = 18;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const x = (i: number) => padL + (i / (POINTS - 1)) * plotW;
  const y = (val: number) => padT + (1 - (val - MIN) / (MAX - MIN)) * plotH;

  const line = series.map((v, i) => `${i === 0 ? 'M' : 'L'} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(' ');
  const gridVals = [34, 36, 38, 40, 42, 44, 46];
  const times = ['12:15', '13:00', '13:45', '14:30', '15:15', '16:00', '16:45', '17:30', '18:00'];
  const c = color ?? '#73bf69';

  return (
    <div className={styles.wrap}>
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className={styles.svg}>
        {gridVals.map((gv) => (
          <g key={gv}>
            <line x1={padL} x2={w - padR} y1={y(gv)} y2={y(gv)} className={styles.grid} />
            <text x={2} y={y(gv) + 3} className={styles.axis}>
              {gv}
            </text>
          </g>
        ))}
        <path d={line} fill="none" stroke={c} strokeWidth={1} opacity={0.8} />
        {series.map((v, i) => (i % 2 === 0 ? <circle key={i} cx={x(i)} cy={y(v)} r={1.7} fill={c} /> : null))}
      </svg>
      <div className={styles.xaxis}>
        {times.map((tm) => (
          <span key={tm}>{tm}</span>
        ))}
      </div>
      <div className={styles.legend}>
        <span className={styles.dot} style={{ background: c }} /> A-series
      </div>
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  wrap: css({
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    padding: theme.spacing(1, 1, 0.5, 0),
  }),
  svg: css({
    width: '100%',
    flex: 1,
    minHeight: 0,
  }),
  grid: css({
    stroke: theme.colors.border.weak,
    strokeWidth: 0.5,
  }),
  axis: css({
    fill: theme.colors.text.secondary,
    fontSize: '10px',
  }),
  xaxis: css({
    display: 'flex',
    justifyContent: 'space-between',
    padding: theme.spacing(0, 1, 0, 3.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  legend: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
    padding: theme.spacing(0.5, 0, 0, 3.5),
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
  }),
  dot: css({
    width: 8,
    height: 8,
    borderRadius: '50%',
    display: 'inline-block',
  }),
});
