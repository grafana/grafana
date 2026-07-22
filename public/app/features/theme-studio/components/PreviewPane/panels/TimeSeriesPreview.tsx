import { useId } from 'react';

import { t } from '@grafana/i18n';

import { PreviewPanelShell } from './PreviewPanelShell';
import { type PreviewThemeTokens } from './previewTheme';

interface TimeSeriesPreviewProps {
  tokens: PreviewThemeTokens;
  /** Height of the chart drawing area in px. */
  chartHeight?: number;
}

const SAMPLE_VALUES: number[][] = [
  [42, 55, 58, 45, 52, 68, 63, 59],
  [58, 62, 60, 54, 57, 65, 70, 66],
];

const hexToRgba = (hex: string, alpha: number) => {
  const raw = hex.replace('#', '');
  const normalized =
    raw.length === 3
      ? raw
          .split('')
          .map((char) => char + char)
          .join('')
      : raw.padEnd(6, '0');
  const r = parseInt(normalized.substring(0, 2), 16);
  const g = parseInt(normalized.substring(2, 4), 16);
  const b = parseInt(normalized.substring(4, 6), 16);
  if ([r, g, b].some((channel) => Number.isNaN(channel))) {
    return `rgba(255, 255, 255, ${alpha})`;
  }
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getPoints = (values: number[], height: number, padding = 0) => {
  const max = Math.max(...values);
  const denominator = Math.max(values.length - 1, 1);
  return values.map((value, index) => {
    const x = (index / denominator) * 100;
    const y = height - (value / max) * (height - padding);
    return { x, y };
  });
};

const buildSmoothPath = (points: Array<{ x: number; y: number }>) => {
  if (points.length < 2) {
    return '';
  }
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    d += ` Q ${prev.x},${prev.y} ${midX},${midY}`;
  }
  d += ` T ${points[points.length - 1].x},${points[points.length - 1].y}`;
  return d;
};

const buildSmoothAreaPath = (points: Array<{ x: number; y: number }>, height: number) => {
  if (!points.length) {
    return '';
  }
  const linePath = buildSmoothPath(points);
  return `${linePath} L ${points[points.length - 1].x},${height} L 0,${height} Z`;
};

export const TimeSeriesPreview = ({ tokens, chartHeight = 140 }: TimeSeriesPreviewProps) => {
  const gradientPrefix = useId().replace(/:/g, '_');
  const seriesNames = [
    t('theme-studio.preview.series-api', 'API latency'),
    t('theme-studio.preview.series-db', 'DB latency'),
  ];
  const seriesWithColors = SAMPLE_VALUES.map((values, index) => ({
    name: seriesNames[index],
    values,
    color: tokens.seriesPalette[index % tokens.seriesPalette.length],
  }));

  return (
    <PreviewPanelShell
      tokens={tokens}
      title={t('theme-studio.preview.latency-overview', 'Latency overview')}
      subtitle={t('theme-studio.preview.synthetic', 'Synthetic workload · Sample data')}
      toolbar={
        <span
          style={{
            padding: '2px 10px',
            borderRadius: 999,
            fontSize: 11,
            fontWeight: 600,
            background: tokens.primary,
            color: tokens.buttonTextOnAccent,
          }}
        >
          {t('theme-studio.preview.last-15m', 'Last 15m')}
        </span>
      }
    >
      <div style={{ position: 'relative', width: '100%', height: chartHeight }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
          {[0, 1, 2, 3].map((index) => {
            const y = 20 + index * 15;
            return (
              <line key={`grid-${index}`} x1={0} x2={100} y1={y} y2={y} stroke={tokens.gridLine} strokeWidth={0.4} />
            );
          })}
          {[0, 1, 2, 3].map((index) => {
            const x = 5 + index * 30;
            return (
              <line key={`v-grid-${index}`} x1={x} x2={x} y1={20} y2={80} stroke={tokens.gridLine} strokeWidth={0.4} />
            );
          })}
          <line x1={0} x2={0} y1={20} y2={80} stroke={tokens.gridLine} strokeWidth={0.6} />
          <line x1={0} x2={100} y1={80} y2={80} stroke={tokens.gridLine} strokeWidth={0.6} />
          {seriesWithColors.map((entry, seriesIdx) => {
            const points = getPoints(entry.values, 80, 10);
            const gradientId = `${gradientPrefix}-series-${seriesIdx}`;
            return (
              <g key={entry.name}>
                <defs>
                  <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor={hexToRgba(entry.color, 0.45)} />
                    <stop offset="100%" stopColor={hexToRgba(entry.color, 0.05)} />
                  </linearGradient>
                </defs>
                <path d={buildSmoothAreaPath(points, 80)} fill={`url(#${gradientId})`} stroke="none" opacity={0.75} />
                <path
                  d={buildSmoothPath(points)}
                  fill="none"
                  stroke={entry.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </g>
            );
          })}
        </svg>
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: 11,
            color: tokens.panelTextSecondary,
            padding: '0 4px',
          }}
        >
          {['-30m', '-20m', '-10m', 'Now'].map((tick) => (
            <span key={tick}>{tick}</span>
          ))}
        </div>
      </div>
      <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {seriesWithColors.map((entry) => (
          <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
            <div style={{ width: 16, height: 3, borderRadius: 999, background: entry.color }} />
            <div>{entry.name}</div>
          </div>
        ))}
      </div>
    </PreviewPanelShell>
  );
};
