import { useMemo } from 'react';

import { useTheme2 } from '@grafana/ui';

// Deterministic LCG so charts don't flicker on re-render
function prng(seed: number) {
  let s = (seed ^ 0xdeadbeef) >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

interface Series {
  name: string;
  color: string;
  values: number[];
}

export function buildSeriesData(title: string): Series[] {
  const COLORS = ['#5794F2', '#FF780A', '#37872D', '#B877D9'];
  const isMany = title.includes('many');
  const isMulti = title.includes('Multiple') || title.toLowerCase().includes('multi');
  const N = isMany ? 72 : 9;

  if (isMulti) {
    const r0 = prng(1), r1 = prng(2), r2 = prng(3);
    return [
      {
        name: 'A-series', color: COLORS[1],
        values: [40, 35, 22, 48, 65, 58, 47, 52, 62].map((v) => v + (r0() - 0.5) * 4),
      },
      {
        name: 'B-series', color: COLORS[2],
        values: [0, 12, 28, 8, 32, 64, 48, 22, 12].map((v) => v + (r1() - 0.5) * 4),
      },
      {
        name: 'C-series', color: COLORS[0],
        values: [42, 28, 18, 62, 52, 38, 28, 58, 68].map((v) => v + (r2() - 0.5) * 4),
      },
    ];
  }

  if (isMany) {
    const rand = prng(42);
    const values = Array.from({ length: N }, (_, i) => {
      const base = 16 + 3 * Math.sin(i * 0.22) + 2 * Math.sin(i * 0.07);
      return base + (rand() - 0.5) * 5 + (rand() > 0.93 ? rand() * 6 : 0);
    });
    return [{ name: 'A-series', color: COLORS[1], values }];
  }

  const rand = prng(7);
  return [{
    name: 'A-series', color: COLORS[1],
    values: [2, 18, 42, 68, 82, 70, 46, 24, 6].map((v) => v + (rand() - 0.5) * 3),
  }];
}

interface MockVizProps {
  type?: string;
  title: string;
  height?: number;
}

export function MockViz({ title, height = 150 }: MockVizProps) {
  const theme = useTheme2();
  const series = useMemo(() => buildSeriesData(title), [title]);

  const isMany = title.includes('many');
  const isMulti = series.length > 1;
  const showDots = !isMany;
  const legendH = isMulti ? 20 : 0;

  const W = 440, H = height;
  const ML = 32, MR = 8, MT = 6, MB = 22 + legendH;
  const PW = W - ML - MR;
  const PH = H - MT - MB;

  const allVals = series.flatMap((s) => s.values);
  const rawMin = Math.min(...allVals);
  const rawMax = Math.max(...allVals);
  const pad = (rawMax - rawMin) * 0.1 || 5;
  const yMin = Math.max(0, rawMin - pad);
  const yMax = rawMax + pad;
  const yRange = yMax - yMin;

  const toX = (i: number, n: number) => ML + (i / (n - 1)) * PW;
  const toY = (v: number) => MT + PH - ((v - yMin) / yRange) * PH;

  const gridValues = [yMin + yRange * 0.25, yMin + yRange * 0.5, yMin + yRange * 0.75];
  const xLabels = ['06:00', '07:30', '09:00', '10:30', '12:00'];

  const gridColor = theme.isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';
  const axisColor = theme.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
  const textColor = theme.isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.38)';

  return (
    <svg
      width="100%"
      height="100%"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block' }}
    >
      <defs>
        {series.map((s) => (
          <linearGradient key={s.name} id={`grad-${s.name}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={s.color} stopOpacity={isMany ? 0.25 : 0.18} />
            <stop offset="100%" stopColor={s.color} stopOpacity={0} />
          </linearGradient>
        ))}
      </defs>

      {gridValues.map((v, i) => (
        <line key={i} x1={ML} y1={toY(v)} x2={ML + PW} y2={toY(v)} stroke={gridColor} strokeWidth={1} />
      ))}

      {gridValues.map((v, i) => (
        <text key={i} x={ML - 4} y={toY(v) + 4} textAnchor="end" fontSize={9} fill={textColor}>
          {v.toFixed(0)}
        </text>
      ))}

      <line x1={ML} y1={MT + PH} x2={ML + PW} y2={MT + PH} stroke={axisColor} strokeWidth={1} />

      {xLabels.map((label, i) => (
        <text key={i} x={ML + (i / (xLabels.length - 1)) * PW} y={MT + PH + 14} textAnchor="middle" fontSize={9} fill={textColor}>
          {label}
        </text>
      ))}

      {series.map((s) => {
        const N = s.values.length;
        const pts = s.values.map((v, i) => [toX(i, N), toY(v)] as [number, number]);
        const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
        const baseY = toY(yMin);
        const areaPath = `${linePath} L${pts[pts.length - 1][0].toFixed(1)},${baseY} L${pts[0][0].toFixed(1)},${baseY} Z`;

        return (
          <g key={s.name}>
            <path d={areaPath} fill={`url(#grad-${s.name})`} />
            <path d={linePath} fill="none" stroke={s.color} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" />
            {showDots && pts.map(([x, y], i) => (
              <circle key={i} cx={x} cy={y} r={2.5} fill={s.color} />
            ))}
          </g>
        );
      })}

      {isMulti && series.map((s, i) => {
        const lx = ML + i * 90;
        const ly = H - 6;
        return (
          <g key={s.name}>
            <line x1={lx} y1={ly} x2={lx + 12} y2={ly} stroke={s.color} strokeWidth={2} />
            <circle cx={lx + 6} cy={ly} r={2} fill={s.color} />
            <text x={lx + 16} y={ly + 3.5} fontSize={9} fill={textColor}>{s.name}</text>
          </g>
        );
      })}
    </svg>
  );
}
