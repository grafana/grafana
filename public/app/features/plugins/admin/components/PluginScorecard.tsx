import { css } from '@emotion/css';
import { useEffect, useRef, useState } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { useDispatch } from 'app/types/store';

import { fetchPluginInsights } from '../state/actions';
import { type CatalogPlugin, type CatalogPluginInsights } from '../types';

const SIZE = 64;
const CX = SIZE / 2;
const CY = SIZE / 2;
const ARC_START = 90;
const ARC_SWEEP = 270;

const RINGS = [
  { key: 'safety', r: SIZE * 0.4 },
  { key: 'quality', r: SIZE * 0.28 },
  { key: 'community', r: SIZE * 0.16 },
];

const STROKE = SIZE * 0.06;
const SCORE_FONT_SIZE = SIZE * 0.26;
const UNIT_FONT_SIZE = SIZE * 0.08;

const COLOR_EXCELLENT = '#7ebb68';
const COLOR_GOOD = '#e4d060';
const COLOR_FAIR = '#f57c2a';

function scoreColor(level: string, theme: GrafanaTheme2): string {
  switch (level) {
    case 'Excellent':
      return COLOR_EXCELLENT;
    case 'Good':
      return COLOR_GOOD;
    case 'Fair':
      return COLOR_FAIR;
    default:
      return theme.colors.error.main;
  }
}

function degToRad(d: number) {
  return (d * Math.PI) / 180;
}

function arcPath(cx: number, cy: number, r: number, startDeg: number, sweepDeg: number): string {
  const startRad = degToRad(startDeg);
  const endRad = degToRad(startDeg + sweepDeg);
  const x1 = cx + r * Math.cos(startRad);
  const y1 = cy + r * Math.sin(startRad);
  const x2 = cx + r * Math.cos(endRad);
  const y2 = cy + r * Math.sin(endRad);
  const large = sweepDeg > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

function arcLength(r: number, sweepDeg: number): number {
  return (sweepDeg / 360) * 2 * Math.PI * r;
}

function overallScore(insights: CatalogPluginInsights): number {
  const dims = insights.insights?.filter((d) => typeof d.scoreValue === 'number' && !isNaN(d.scoreValue));
  if (!dims?.length) {
    return 0;
  }
  return Math.round(dims.reduce((sum, d) => sum + d.scoreValue, 0) / dims.length);
}

function hasValidData(insights: CatalogPluginInsights): boolean {
  return Boolean(
    insights.insights?.some((d) => typeof d.scoreValue === 'number' && !isNaN(d.scoreValue) && d.scoreValue > 0)
  );
}

type State = 'idle' | 'loading' | 'loaded' | 'nodata';

type Props = {
  plugin: CatalogPlugin;
};

export function PluginScorecard({ plugin }: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const dispatch = useDispatch();
  const hasFetched = useRef(false);
  const [state, setState] = useState<State>('idle');
  const insights: CatalogPluginInsights | undefined = plugin.insights;

  useEffect(() => {
    if (insights) {
      setState(hasValidData(insights) ? 'loaded' : 'nodata');
      return;
    }
    if (hasFetched.current) {
      return;
    }
    const version = plugin.installedVersion ?? plugin.latestVersion;
    if (!version) {
      setState('nodata');
      hasFetched.current = true;
      return;
    }
    hasFetched.current = true;
    setState('loading');
    dispatch(fetchPluginInsights({ id: plugin.id, version })).then(() => {
      // insights will update via Redux — the effect above will fire
    });
  }, [plugin.id]); // eslint-disable-line

  useEffect(() => {
    if (!insights) {
      return;
    }
    setState(hasValidData(insights) ? 'loaded' : 'nodata');
  }, [insights]);

  const trackColor = theme.colors.border.medium;

  if (state === 'loading') {
    return (
      <div aria-label={t('plugins.plugin-scorecard.aria-label-loading', 'Loading scorecard')}>
        <svg width={SIZE} height={SIZE}>
          <defs>
            <linearGradient
              id="loading-grad"
              gradientUnits="userSpaceOnUse"
              x1={CX}
              y1={CY - RINGS[0].r}
              x2={CX}
              y2={CY + RINGS[0].r}
            >
              <stop offset="0%" stopColor={trackColor} stopOpacity="1" />
              <stop offset="100%" stopColor={trackColor} stopOpacity="0.15" />
              <animateTransform
                attributeName="gradientTransform"
                attributeType="XML"
                type="rotate"
                from={`0 ${CX} ${CY}`}
                to={`360 ${CX} ${CY}`}
                dur="2s"
                repeatCount="indefinite"
              />
            </linearGradient>
          </defs>
          {RINGS.map(({ key, r }) => (
            <path
              key={key}
              d={arcPath(CX, CY, r, ARC_START, ARC_SWEEP)}
              fill="none"
              stroke="url(#loading-grad)"
              strokeWidth={STROKE}
              strokeLinecap="round"
            />
          ))}
        </svg>
      </div>
    );
  }

  if (state === 'nodata') {
    // Gradient runs from arc start (6 o'clock = bottom) to arc end (3 o'clock = right)
    const gradStart = { x: CX + 0, y: CY + RINGS[0].r }; // 90° = bottom
    const gradEnd = { x: CX + RINGS[0].r, y: CY + 0 }; // 0° = right
    return (
      <Tooltip content={t('plugins.plugin-scorecard.no-data', 'No scorecard data available')} placement="top">
        <div
          className={styles.nodata}
          aria-label={t('plugins.plugin-scorecard.aria-label-nodata', 'No scorecard data')}
        >
          <svg width={SIZE} height={SIZE}>
            <defs>
              <linearGradient
                id="nodata-fade"
                gradientUnits="userSpaceOnUse"
                x1={gradStart.x}
                y1={gradStart.y}
                x2={gradEnd.x}
                y2={gradEnd.y}
              >
                <stop offset="0%" stopColor={trackColor} stopOpacity="1" />
                <stop offset="100%" stopColor={trackColor} stopOpacity="0.25" />
              </linearGradient>
            </defs>
            {RINGS.map(({ key, r }) => (
              <path
                key={key}
                d={arcPath(CX, CY, r, ARC_START, ARC_SWEEP)}
                fill="none"
                stroke="url(#nodata-fade)"
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
            ))}
            <text
              x={CX + CX * 0.5}
              y={CY + CY * 0.5 + SIZE * 0.06}
              textAnchor="middle"
              dominantBaseline="auto"
              fontSize={SCORE_FONT_SIZE * 0.75}
              fontWeight="bold"
              fill={theme.colors.text.disabled}
            >
              {t('plugins.plugin-scorecard.no-data-score', 'N/A')}
            </text>
          </svg>
        </div>
      </Tooltip>
    );
  }

  if (state !== 'loaded' || !insights) {
    return null;
  }

  const scoreMap: Record<string, number> = {};
  const levelMap: Record<string, string> = {};
  const countMap: Record<string, number> = {};
  for (const dim of insights.insights) {
    scoreMap[dim.name] = dim.scoreValue;
    levelMap[dim.name] = dim.scoreLevel;
    countMap[dim.name] = dim.items?.length ?? 0;
  }

  const total = overallScore(insights);
  const totalLevel = total >= 85 ? 'Excellent' : total >= 65 ? 'Good' : total >= 45 ? 'Fair' : 'Poor';
  const totalColor = scoreColor(totalLevel, theme);
  const scoreX = CX + CX * 0.5;
  const scoreY = CY + CY * 0.5;

  return (
    <Tooltip
      content={
        <div className={styles.tooltip}>
          <div className={styles.tooltipHeader}>
            <span className={styles.tooltipOverallLabel}>
              {t('plugins.plugin-scorecard.tooltip-scorecard', 'Scorecard')}
            </span>
            <span className={styles.tooltipRight}>
              <span className={styles.tooltipTotal} style={{ color: totalColor }}>
                {total}
              </span>
              <span className={styles.tooltipTotalLabel}>{t('plugins.plugin-scorecard.out-of', '/ 100')}</span>
            </span>
          </div>
          <div className={styles.tooltipDivider} />
          {RINGS.map(({ key }) => {
            const level = levelMap[key] ?? '';
            const count = countMap[key] ?? 0;
            const dotColor = scoreColor(level, theme);
            return (
              <div key={key} className={styles.tooltipRow}>
                <span className={styles.tooltipDot} style={{ background: dotColor }} />
                <span className={styles.tooltipLabel}>{key}</span>
                <span className={styles.tooltipRight}>
                  {count > 1 && <span className={styles.tooltipBadge}>⚠ {count}</span>}
                  <span className={styles.tooltipScore}>{level || '—'}</span>
                </span>
              </div>
            );
          })}
        </div>
      }
      placement="top"
    >
      <div aria-label={t('plugins.plugin-scorecard.aria-label', 'Plugin scorecard')}>
        <svg width={SIZE} height={SIZE}>
          <defs>
            <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            <filter id="text-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="0.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {RINGS.map(({ key, r }) => {
            const score = scoreMap[key] ?? 0;
            const level = levelMap[key] ?? '';
            const fillColor = scoreColor(level, theme);
            const totalLen = arcLength(r, ARC_SWEEP);
            const fillLen = (score / 100) * totalLen;
            return (
              <g key={key}>
                <path
                  d={arcPath(CX, CY, r, ARC_START, ARC_SWEEP)}
                  fill="none"
                  stroke={trackColor}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                />
                <path
                  d={arcPath(CX, CY, r, ARC_START, ARC_SWEEP)}
                  fill="none"
                  stroke={fillColor}
                  strokeWidth={STROKE}
                  strokeLinecap="round"
                  strokeDasharray={`${fillLen} ${totalLen}`}
                  filter="url(#arc-glow)"
                />
              </g>
            );
          })}
          <text
            x={scoreX}
            y={scoreY + SIZE * 0.06}
            textAnchor="middle"
            dominantBaseline="auto"
            fontSize={SCORE_FONT_SIZE}
            fontWeight="bold"
            fill={totalColor}
            filter="url(#text-glow)"
          >
            {total}
          </text>
          <text
            x={scoreX}
            y={scoreY + SIZE * 0.14}
            textAnchor="middle"
            dominantBaseline="hanging"
            fontSize={UNIT_FONT_SIZE}
            fill={theme.colors.text.disabled}
          >
            {t('plugins.plugin-scorecard.out-of', '/ 100')}
          </text>
        </svg>
      </div>
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  nodata: css({
    opacity: 0.35,
    cursor: 'default',
  }),
  tooltip: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
    minWidth: '160px',
  }),
  tooltipHeader: css({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing(1),
  }),
  tooltipTotal: css({
    fontSize: theme.typography.h4.fontSize,
    fontWeight: theme.typography.fontWeightBold,
    lineHeight: 1,
  }),
  tooltipTotalLabel: css({
    fontSize: theme.typography.h4.fontSize,
    color: theme.colors.text.disabled,
  }),
  tooltipOverallLabel: css({
    fontSize: theme.typography.size.sm,
    fontWeight: theme.typography.fontWeightMedium,
    color: theme.colors.text.primary,
  }),
  tooltipDivider: css({
    height: '1px',
    background: theme.colors.border.weak,
    margin: `${theme.spacing(0.25)} 0`,
  }),
  tooltipRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  }),
  tooltipDot: css({
    width: '8px',
    height: '8px',
    borderRadius: theme.shape.radius.circle,
    flexShrink: 0,
  }),
  tooltipLabel: css({
    textTransform: 'capitalize',
    color: theme.colors.text.secondary,
    flexGrow: 1,
  }),
  tooltipRight: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.5),
  }),
  tooltipScore: css({
    color: theme.colors.text.primary,
    fontWeight: theme.typography.fontWeightMedium,
  }),
  tooltipBadge: css({
    background: theme.colors.background.secondary,
    border: `1px solid ${theme.colors.border.medium}`,
    borderRadius: theme.shape.radius.pill,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.xs,
    lineHeight: 1,
    padding: `${theme.spacing(0.25)} ${theme.spacing(0.5)}`,
  }),
});
