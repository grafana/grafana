import { css, cx } from '@emotion/css';
import { type JSX } from 'react';

import { type FieldDisplay, formattedValueToString, type GrafanaTheme2, VizOrientation } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BigValueColorMode, BigValueJustifyMode, PercentChangeColorMode } from '@grafana/schema';
import { DataLinksContextMenu, useStyles2 } from '@grafana/ui';
import { type DataLinksContextMenuApi } from '@grafana/ui/internal';
import { dashVar } from 'app/core/dashboardStyle/cssVars';

import { type Options } from './panelcfg.gen';

const MIN_FIGURE_WIDTH = 140;
const MIN_FONT_SIZE = 28;
const MAX_FONT_SIZE = 72;
const GAP = 16;
const PADDING = 12;
/** Vertical room left for the label, change line and caption around the number. */
const SURROUNDING_TEXT_HEIGHT = 64;
const AFFIX_RATIO = 0.4;
const THIN_SPACE = '\u2009';

export type ChangeTone = 'good' | 'bad' | 'value';

/**
 * Mirrors the stat panel's percent change colouring: `standard` treats an increase as good,
 * `inverted` treats a decrease as good, `same_as_value` follows the value colour. No change is
 * never bad.
 */
export function getChangeTone(percentChange: number, mode: PercentChangeColorMode | undefined): ChangeTone {
  if (mode === PercentChangeColorMode.SameAsValue) {
    return 'value';
  }
  if (percentChange === 0) {
    return 'good';
  }
  const direction = mode === PercentChangeColorMode.Inverted ? -1 : 1;
  return percentChange * direction > 0 ? 'good' : 'bad';
}

/** `percentChange` is in percent units, so 12.4 renders as `12.4%`. */
export function formatPercentChange(percentChange: number): string {
  return (Math.abs(percentChange) / 100).toLocaleString(undefined, { style: 'percent', maximumSignificantDigits: 3 });
}

export function getFigureFontSize(
  values: FieldDisplay[],
  width: number,
  height: number,
  orientation: VizOrientation
): number {
  const count = Math.max(values.length, 1);
  const innerWidth = Math.max(width - PADDING * 2, MIN_FIGURE_WIDTH);
  const innerHeight = Math.max(height - PADDING * 2, 0);
  const columns =
    orientation === VizOrientation.Vertical
      ? 1
      : Math.min(count, Math.max(1, Math.floor((innerWidth + GAP) / (MIN_FIGURE_WIDTH + GAP))));
  const rows = Math.ceil(count / columns);
  const itemWidth = (innerWidth - GAP * (columns - 1)) / columns;
  const itemHeight = (innerHeight - GAP * (rows - 1)) / rows;

  const longest = values.reduce((max, { display }) => {
    const affixLength = (display.prefix?.length ?? 0) + (display.suffix?.trim().length ?? 0);
    return Math.max(max, display.text.length + affixLength * AFFIX_RATIO);
  }, 1);

  const byHeight = (itemHeight - SURROUNDING_TEXT_HEIGHT) * 0.9;
  const byWidth = itemWidth / (longest * 0.6);
  return Math.round(Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, Math.min(byHeight, byWidth))));
}

interface StatFiguresProps {
  values: FieldDisplay[];
  options: Options;
  width: number;
  height: number;
}

export function StatFigures({ values, options, width, height }: StatFiguresProps) {
  const styles = useStyles2(getStyles);
  const fontSize = options.text?.valueSize ?? getFigureFontSize(values, width, height, options.orientation);
  const centered = options.justifyMode === BigValueJustifyMode.Center;

  return (
    <div
      className={cx(
        styles.list,
        options.orientation === VizOrientation.Vertical && styles.vertical,
        centered && styles.centered
      )}
      style={{ width, height }}
    >
      {values.map((value, index) => {
        const key = `${value.display.title ?? value.name}-${index}`;
        const { hasLinks, getLinks } = value;
        if (hasLinks && getLinks) {
          return (
            <DataLinksContextMenu key={key} links={getLinks}>
              {(api) => <StatFigure value={value} options={options} fontSize={fontSize} menu={api} />}
            </DataLinksContextMenu>
          );
        }
        return <StatFigure key={key} value={value} options={options} fontSize={fontSize} menu={{}} />;
      })}
    </div>
  );
}

interface StatFigureProps {
  value: FieldDisplay;
  options: Options;
  fontSize: number;
  menu: DataLinksContextMenuApi;
}

function StatFigure({ value, options, fontSize, menu }: StatFigureProps): JSX.Element {
  const styles = useStyles2(getStyles);
  const { display } = value;
  const label = display.title ?? '';
  const valueColor = options.colorMode === BigValueColorMode.None ? undefined : display.color;
  const prefix = display.prefix?.trim();
  const suffix = display.suffix?.trim();

  const percentChange = display.percentChange;
  const hasChange = options.showPercentChange && percentChange != null && !Number.isNaN(percentChange);
  const tone = hasChange ? getChangeTone(percentChange, options.percentChangeColorMode) : undefined;
  const changeText = hasChange ? formatPercentChange(percentChange) : '';
  const caption = value.field.description;

  const accessibleValue = formattedValueToString(display).trim();
  const accessibleChange = hasChange ? describeChange(percentChange, changeText) : '';
  const ariaLabel = [label ? `${label}: ${accessibleValue}` : accessibleValue, accessibleChange]
    .filter(Boolean)
    .join(', ');

  const numberProps = menu.triggerProps ?? (menu.openMenu ? { onClick: menu.openMenu } : {});

  return (
    <div role="group" aria-label={ariaLabel} className={styles.figure}>
      {label && (
        <div
          className={styles.label}
          style={options.text?.titleSize ? { fontSize: options.text.titleSize } : undefined}
        >
          {label}
        </div>
      )}
      <div
        {...numberProps}
        className={cx(styles.value, menu.targetClassName)}
        style={{ fontSize, color: valueColor }}
        data-testid="stat-figure-value"
      >
        {prefix && (
          <span className={styles.affix}>
            {prefix}
            {THIN_SPACE}
          </span>
        )}
        <span>{display.text}</span>
        {suffix && (
          <span className={styles.affix}>
            {THIN_SPACE}
            {suffix}
          </span>
        )}
      </div>
      {hasChange && (
        <div
          className={cx(styles.change, tone === 'bad' && styles.changeBad)}
          style={tone === 'value' ? { color: display.color } : undefined}
        >
          <span aria-hidden="true">{changeArrow(percentChange)}</span> {changeText}{' '}
          {t('stat.figure.change-reference', 'vs start of range')}
        </div>
      )}
      {caption && (
        <div className={styles.caption} title={caption}>
          {caption}
        </div>
      )}
    </div>
  );
}

function changeArrow(percentChange: number): string {
  if (percentChange > 0) {
    return '▲';
  }
  if (percentChange < 0) {
    return '▼';
  }
  return '—';
}

function describeChange(percentChange: number, change: string): string {
  if (percentChange > 0) {
    return t('stat.figure.change-up', 'up {{change}} vs start of range', { change });
  }
  if (percentChange < 0) {
    return t('stat.figure.change-down', 'down {{change}} vs start of range', { change });
  }
  return t('stat.figure.change-none', 'unchanged vs start of range');
}

const getStyles = (theme: GrafanaTheme2) => {
  const muted = dashVar('muted', theme.colors.text.secondary);
  return {
    list: css({
      display: 'flex',
      flexWrap: 'wrap',
      alignContent: 'flex-start',
      gap: GAP,
      padding: PADDING,
      overflow: 'auto',
    }),
    vertical: css({
      flexDirection: 'column',
      flexWrap: 'nowrap',
    }),
    centered: css({
      justifyContent: 'center',
      alignContent: 'center',
      textAlign: 'center',
    }),
    figure: css({
      flex: `1 1 ${MIN_FIGURE_WIDTH}px`,
      minWidth: MIN_FIGURE_WIDTH,
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(0.5),
    }),
    label: css({
      fontSize: theme.typography.bodySmall.fontSize,
      lineHeight: theme.typography.bodySmall.lineHeight,
      color: muted,
      textTransform: 'none',
      letterSpacing: 'normal',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
    value: css({
      fontFamily: dashVar('fontFigure', theme.typography.fontFamily),
      fontWeight: dashVar('figureWeight', '300'),
      fontVariantNumeric: 'tabular-nums lining-nums',
      lineHeight: 1.05,
      color: dashVar('ink', theme.colors.text.primary),
      whiteSpace: 'nowrap',
    }),
    affix: css({
      fontSize: `${AFFIX_RATIO}em`,
      color: muted,
      verticalAlign: 'baseline',
    }),
    change: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: muted,
      fontVariantNumeric: 'tabular-nums',
    }),
    changeBad: css({
      color: dashVar('bad', theme.colors.error.text),
    }),
    caption: css({
      fontSize: theme.typography.bodySmall.fontSize,
      color: muted,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    }),
  };
};
