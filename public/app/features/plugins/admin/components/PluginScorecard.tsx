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

type State = 'idle' | 'loading' | 'loaded' | 'nodata' | 'core';

type Props = {
  plugin: CatalogPlugin;
  showTooltip?: boolean;
};

export function PluginScorecard({ plugin, showTooltip = true }: Props): React.ReactElement | null {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();
  const dispatch = useDispatch();
  const hasFetched = useRef(false);
  const [state, setState] = useState<State>('idle');
  const insights: CatalogPluginInsights | undefined = plugin.insights;

  useEffect(() => {
    if (insights) {
      setState(hasValidData(insights) ? 'loaded' : plugin.isCore ? 'core' : 'nodata');
      return;
    }
    if (hasFetched.current) {
      return;
    }
    const version = plugin.installedVersion ?? plugin.latestVersion;
    if (!version) {
      setState(plugin.isCore ? 'core' : 'nodata');
      hasFetched.current = true;
      return;
    }
    hasFetched.current = true;
    setState('loading');
    dispatch(fetchPluginInsights({ id: plugin.id, version })).then((action: { type?: string }) => {
      if (fetchPluginInsights.rejected.match(action)) {
        setState(plugin.isCore ? 'core' : 'nodata');
      }
      // on success: insights update via Redux triggers the second effect
    });
  }, [plugin.id, plugin.isCore]); // eslint-disable-line

  useEffect(() => {
    if (!insights) {
      return;
    }
    setState(hasValidData(insights) ? 'loaded' : plugin.isCore ? 'core' : 'nodata');
  }, [insights, plugin.isCore]);

  const trackColor = theme.colors.border.medium;

  if (state === 'loading') {
    return (
      <div
        className={styles.loading}
        aria-label={t('plugins.plugin-scorecard.aria-label-loading', 'Loading scorecard')}
      >
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
    ); // end badge
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

  if (state === 'core') {
    const scoreX = CX + CX * 0.5;
    const scoreY = CY + CY * 0.5;
    const logoSize = SIZE * 0.38;
    const logoX = scoreX - logoSize / 2;
    const logoY = scoreY - logoSize / 2 + SIZE * 0.04;
    return (
      <Tooltip
        content={t('plugins.plugin-scorecard.core-tooltip', 'Core plugin — bundled with Grafana')}
        placement="top"
      >
        <div className={styles.core} aria-label={t('plugins.plugin-scorecard.aria-label-core', 'Core plugin')}>
          <svg width={SIZE} height={SIZE}>
            <defs>
              <linearGradient
                id="core-track-fade"
                gradientUnits="userSpaceOnUse"
                x1={CX}
                y1={CY + RINGS[0].r}
                x2={CX + RINGS[0].r}
                y2={CY}
              >
                <stop offset="0%" stopColor={trackColor} stopOpacity="1" />
                <stop offset="100%" stopColor={trackColor} stopOpacity="0.25" />
              </linearGradient>
              <linearGradient id="grafana-logo-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={trackColor} />
                <stop offset="100%" stopColor={trackColor} />
              </linearGradient>
            </defs>
            {RINGS.map(({ key, r }) => (
              <path
                key={key}
                d={arcPath(CX, CY, r, ARC_START, ARC_SWEEP)}
                fill="none"
                stroke="url(#core-track-fade)"
                strokeWidth={STROKE}
                strokeLinecap="round"
              />
            ))}
            <g transform={`translate(${logoX}, ${logoY}) scale(${logoSize / 351})`}>
              <path
                fill="url(#grafana-logo-grad)"
                d="M342,161.2c-0.6-6.1-1.6-13.1-3.6-20.9c-2-7.7-5-16.2-9.4-25c-4.4-8.8-10.1-17.9-17.5-26.8c-2.9-3.5-6.1-6.9-9.5-10.2c5.1-20.3-6.2-37.9-6.2-37.9c-19.5-1.2-31.9,6.1-36.5,9.4c-0.8-0.3-1.5-0.7-2.3-1c-3.3-1.3-6.7-2.6-10.3-3.7c-3.5-1.1-7.1-2.1-10.8-3c-3.7-0.9-7.4-1.6-11.2-2.2c-0.7-0.1-1.3-0.2-2-0.3c-8.5-27.2-32.9-38.6-32.9-38.6c-27.3,17.3-32.4,41.5-32.4,41.5s-0.1,0.5-0.3,1.4c-1.5,0.4-3,0.9-4.5,1.3c-2.1,0.6-4.2,1.4-6.2,2.2c-2.1,0.8-4.1,1.6-6.2,2.5c-4.1,1.8-8.2,3.8-12.2,6c-3.9,2.2-7.7,4.6-11.4,7.1c-0.5-0.2-1-0.4-1-0.4c-37.8-14.4-71.3,2.9-71.3,2.9c-3.1,40.2,15.1,65.5,18.7,70.1c-0.9,2.5-1.7,5-2.5,7.5c-2.8,9.1-4.9,18.4-6.2,28.1c-0.2,1.4-0.4,2.8-0.5,4.2C18.8,192.7,8.5,228,8.5,228c29.1,33.5,63.1,35.6,63.1,35.6c0,0,0.1-0.1,0.1-0.1c4.3,7.7,9.3,15,14.9,21.9c2.4,2.9,4.8,5.6,7.4,8.3c-10.6,30.4,1.5,55.6,1.5,55.6c32.4,1.2,53.7-14.2,58.2-17.7c3.2,1.1,6.5,2.1,9.8,2.9c10,2.6,20.2,4.1,30.4,4.5c2.5,0.1,5.1,0.2,7.6,0.1l1.2,0l0.8,0l1.6,0l1.6-0.1l0,0.1c15.3,21.8,42.1,24.9,42.1,24.9c19.1-20.1,20.2-40.1,20.2-44.4l0,0c0,0,0-0.1,0-0.3c0-0.4,0-0.6,0-0.6l0,0c0-0.3,0-0.6,0-0.9c4-2.8,7.8-5.8,11.4-9.1c7.6-6.9,14.3-14.8,19.9-23.3c0.5-0.8,1-1.6,1.5-2.4c21.6,1.2,36.9-13.4,36.9-13.4c-3.6-22.5-16.4-33.5-19.1-35.6l0,0c0,0-0.1-0.1-0.3-0.2c-0.2-0.1-0.2-0.2-0.2-0.2c0,0,0,0,0,0c-0.1-0.1-0.3-0.2-0.5-0.3c0.1-1.4,0.2-2.7,0.3-4.1c0.2-2.4,0.2-4.9,0.2-7.3l0-1.8l0-0.9l0-0.5c0-0.6,0-0.4,0-0.6l-0.1-1.5l-0.1-2c0-0.7-0.1-1.3-0.2-1.9c-0.1-0.6-0.1-1.3-0.2-1.9l-0.2-1.9l-0.3-1.9c-0.4-2.5-0.8-4.9-1.4-7.4c-2.3-9.7-6.1-18.9-11-27.2c-5-8.3-11.2-15.6-18.3-21.8c-7-6.2-14.9-11.2-23.1-14.9c-8.3-3.7-16.9-6.1-25.5-7.2c-4.3-0.6-8.6-0.8-12.9-0.7l-1.6,0l-0.4,0c-0.1,0-0.6,0-0.5,0l-0.7,0l-1.6,0.1c-0.6,0-1.2,0.1-1.7,0.1c-2.2,0.2-4.4,0.5-6.5,0.9c-8.6,1.6-16.7,4.7-23.8,9c-7.1,4.3-13.3,9.6-18.3,15.6c-5,6-8.9,12.7-11.6,19.6c-2.7,6.9-4.2,14.1-4.6,21c-0.1,1.7-0.1,3.5-0.1,5.2c0,0.4,0,0.9,0,1.3l0.1,1.4c0.1,0.8,0.1,1.7,0.2,2.5c0.3,3.5,1,6.9,1.9,10.1c1.9,6.5,4.9,12.4,8.6,17.4c3.7,5,8.2,9.1,12.9,12.4c4.7,3.2,9.8,5.5,14.8,7c5,1.5,10,2.1,14.7,2.1c0.6,0,1.2,0,1.7,0c0.3,0,0.6,0,0.9,0c0.3,0,0.6,0,0.9-0.1c0.5,0,1-0.1,1.5-0.1c0.1,0,0.3,0,0.4-0.1l0.5-0.1c0.3,0,0.6-0.1,0.9-0.1c0.6-0.1,1.1-0.2,1.7-0.3c0.6-0.1,1.1-0.2,1.6-0.4c1.1-0.2,2.1-0.6,3.1-0.9c2-0.7,4-1.5,5.7-2.4c1.8-0.9,3.4-2,5-3c0.4-0.3,0.9-0.6,1.3-1c1.6-1.3,1.9-3.7,0.6-5.3c-1.1-1.4-3.1-1.8-4.7-0.9c-0.4,0.2-0.8,0.4-1.2,0.6c-1.4,0.7-2.8,1.3-4.3,1.8c-1.5,0.5-3.1,0.9-4.7,1.2c-0.8,0.1-1.6,0.2-2.5,0.3c-0.4,0-0.8,0.1-1.3,0.1c-0.4,0-0.9,0-1.2,0c-0.4,0-0.8,0-1.2,0c-0.5,0-1,0-1.5-0.1c0,0-0.3,0-0.1,0l-0.2,0l-0.3,0c-0.2,0-0.5,0-0.7-0.1c-0.5-0.1-0.9-0.1-1.4-0.2c-3.7-0.5-7.4-1.6-10.9-3.2c-3.6-1.6-7-3.8-10.1-6.6c-3.1-2.8-5.8-6.1-7.9-9.9c-2.1-3.8-3.6-8-4.3-12.4c-0.3-2.2-0.5-4.5-0.4-6.7c0-0.6,0.1-1.2,0.1-1.8c0,0.2,0-0.1,0-0.1l0-0.2l0-0.5c0-0.3,0.1-0.6,0.1-0.9c0.1-1.2,0.3-2.4,0.5-3.6c1.7-9.6,6.5-19,13.9-26.1c1.9-1.8,3.9-3.4,6-4.9c2.1-1.5,4.4-2.8,6.8-3.9c2.4-1.1,4.8-2,7.4-2.7c2.5-0.7,5.1-1.1,7.8-1.4c1.3-0.1,2.6-0.2,4-0.2c0.4,0,0.6,0,0.9,0l1.1,0l0.7,0c0.3,0,0,0,0.1,0l0.3,0l1.1,0.1c2.9,0.2,5.7,0.6,8.5,1.3c5.6,1.2,11.1,3.3,16.2,6.1c10.2,5.7,18.9,14.5,24.2,25.1c2.7,5.3,4.6,11,5.5,16.9c0.2,1.5,0.4,3,0.5,4.5l0.1,1.1l0.1,1.1c0,0.4,0,0.8,0,1.1c0,0.4,0,0.8,0,1.1l0,1l0,1.1c0,0.7-0.1,1.9-0.1,2.6c-0.1,1.6-0.3,3.3-0.5,4.9c-0.2,1.6-0.5,3.2-0.8,4.8c-0.3,1.6-0.7,3.2-1.1,4.7c-0.8,3.1-1.8,6.2-3,9.3c-2.4,6-5.6,11.8-9.4,17.1c-7.7,10.6-18.2,19.2-30.2,24.7c-6,2.7-12.3,4.7-18.8,5.7c-3.2,0.6-6.5,0.9-9.8,1l-0.6,0l-0.5,0l-1.1,0l-1.6,0l-0.8,0c0.4,0-0.1,0-0.1,0l-0.3,0c-1.8,0-3.5-0.1-5.3-0.3c-7-0.5-13.9-1.8-20.7-3.7c-6.7-1.9-13.2-4.6-19.4-7.8c-12.3-6.6-23.4-15.6-32-26.5c-4.3-5.4-8.1-11.3-11.2-17.4c-3.1-6.1-5.6-12.6-7.4-19.1c-1.8-6.6-2.9-13.3-3.4-20.1l-0.1-1.3l0-0.3l0-0.3l0-0.6l0-1.1l0-0.3l0-0.4l0-0.8l0-1.6l0-0.3c0,0,0,0.1,0-0.1l0-0.6c0-0.8,0-1.7,0-2.5c0.1-3.3,0.4-6.8,0.8-10.2c0.4-3.4,1-6.9,1.7-10.3c0.7-3.4,1.5-6.8,2.5-10.2c1.9-6.7,4.3-13.2,7.1-19.3c5.7-12.2,13.1-23.1,22-31.8c2.2-2.2,4.5-4.2,6.9-6.2c2.4-1.9,4.9-3.7,7.5-5.4c2.5-1.7,5.2-3.2,7.9-4.6c1.3-0.7,2.7-1.4,4.1-2c0.7-0.3,1.4-0.6,2.1-0.9c0.7-0.3,1.4-0.6,2.1-0.9c2.8-1.2,5.7-2.2,8.7-3.1c0.7-0.2,1.5-0.4,2.2-0.7c0.7-0.2,1.5-0.4,2.2-0.6c1.5-0.4,3-0.8,4.5-1.1c0.7-0.2,1.5-0.3,2.3-0.5c0.8-0.2,1.5-0.3,2.3-0.5c0.8-0.1,1.5-0.3,2.3-0.4l1.1-0.2l1.2-0.2c0.8-0.1,1.5-0.2,2.3-0.3c0.9-0.1,1.7-0.2,2.6-0.3c0.7-0.1,1.9-0.2,2.6-0.3c0.5-0.1,1.1-0.1,1.6-0.2l1.1-0.1l0.5-0.1l0.6,0c0.9-0.1,1.7-0.1,2.6-0.2l1.3-0.1c0,0,0.5,0,0.1,0l0.3,0l0.6,0c0.7,0,1.5-0.1,2.2-0.1c2.9-0.1,5.9-0.1,8.8,0c5.8,0.2,11.5,0.9,17,1.9c11.1,2.1,21.5,5.6,31,10.3c9.5,4.6,17.9,10.3,25.3,16.5c0.5,0.4,0.9,0.8,1.4,1.2c0.4,0.4,0.9,0.8,1.3,1.2c0.9,0.8,1.7,1.6,2.6,2.4c0.9,0.8,1.7,1.6,2.5,2.4c0.8,0.8,1.6,1.6,2.4,2.5c3.1,3.3,6,6.6,8.6,10c5.2,6.7,9.4,13.5,12.7,19.9c0.2,0.4,0.4,0.8,0.6,1.2c0.2,0.4,0.4,0.8,0.6,1.2c0.4,0.8,0.8,1.6,1.1,2.4c0.4,0.8,0.7,1.5,1.1,2.3c0.3,0.8,0.7,1.5,1,2.3c1.2,3,2.4,5.9,3.3,8.6c1.5,4.4,2.6,8.3,3.5,11.7c0.3,1.4,1.6,2.3,3,2.1c1.5-0.1,2.6-1.3,2.6-2.8C342.6,170.4,342.5,166.1,342,161.2z"
              />
            </g>
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

  const tooltipContent = (
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
  );

  const badge = (
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
  );

  if (!showTooltip) {
    return (
      <div className={styles.legendWrap}>
        {badge}
        <div className={styles.legendItems}>
          {RINGS.map(({ key }) => {
            const level = levelMap[key] ?? '';
            const dotColor = scoreColor(level, theme);
            return (
              <div key={key} className={styles.legendRow}>
                <span className={styles.tooltipDot} style={{ background: dotColor }} />
                <span className={styles.legendLabel}>{key}</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <Tooltip content={tooltipContent} placement="top">
      {badge}
    </Tooltip>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  nodata: css({
    opacity: 0.75,
    cursor: 'default',
  }),
  core: css({
    opacity: 0.75,
    cursor: 'default',
  }),
  loading: css({
    opacity: 0.75,
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
  legendWrap: css({
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: theme.spacing(1.5),
  }),
  legendItems: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.5),
  }),
  legendRow: css({
    display: 'flex',
    alignItems: 'center',
    gap: theme.spacing(0.75),
  }),
  legendLabel: css({
    textTransform: 'capitalize',
    color: theme.colors.text.secondary,
    fontSize: theme.typography.size.sm,
  }),
});
