import { css } from '@emotion/css';
import { memo, useMemo } from 'react';
import { type AlignedData } from 'uplot';

import { type Field, formattedValueToString, type GrafanaTheme2 } from '@grafana/data';
import { AxisPlacement, GraphDrawStyle, ScaleDirection, ScaleOrientation, VisibilityMode } from '@grafana/schema';

import { useStyles2, useTheme2 } from '../../../../themes/ThemeContext';
import { UPlotChart } from '../../../uPlot/Plot';
import { UPlotConfigBuilder } from '../../../uPlot/config/UPlotConfigBuilder';
import { TABLE } from '../constants';
import { type HeaderCategoryDistribution, type HeaderHistogramDistribution } from '../headerVisualizations';

const CATEGORY_COLORS = ['blue', 'green', 'orange', 'purple', 'yellow'];
const MIN_CATEGORY_LABEL_WIDTH = 32;
const HISTOGRAM_COLOR = '#6B727C';

export interface HeaderMiniChartProps {
  distribution: HeaderCategoryDistribution | HeaderHistogramDistribution;
  field: Field;
  width: number;
}

export function buildHeaderHistogramConfig(
  distribution: HeaderHistogramDistribution,
  theme: GrafanaTheme2
): UPlotConfigBuilder {
  const config = new UPlotConfigBuilder();
  const xMin = distribution.x[0];
  const xMax = distribution.x.at(-1) ?? xMin + 1;
  const bucketWidth = distribution.x.length > 1 ? distribution.x[1] - distribution.x[0] : 1;
  const maxCount = Math.max(...distribution.counts, 1);

  config.setCursor({ show: false, x: false, y: false, drag: { x: false, y: false, setScale: false } });
  config.setPadding([0, 0, 0, 0]);
  config.addScale({
    scaleKey: 'x',
    orientation: ScaleOrientation.Horizontal,
    direction: ScaleDirection.Right,
    isTime: false,
    range: () => [xMin, xMax + bucketWidth],
  });
  config.addScale({
    scaleKey: 'count',
    orientation: ScaleOrientation.Vertical,
    direction: ScaleDirection.Up,
    range: () => [0, maxCount],
  });
  config.addAxis({ scaleKey: 'x', theme, placement: AxisPlacement.Hidden, show: false });
  config.addAxis({ scaleKey: 'count', theme, placement: AxisPlacement.Hidden, show: false });
  config.addSeries({
    scaleKey: 'count',
    theme,
    drawStyle: GraphDrawStyle.Bars,
    showPoints: VisibilityMode.Never,
    lineColor: HISTOGRAM_COLOR,
    fillColor: HISTOGRAM_COLOR,
    lineWidth: 0,
    barWidthFactor: 0.82,
  });

  return config;
}

function formatEndpoint(field: Field, value: number): string {
  return field.display ? formattedValueToString(field.display(value)) : String(value);
}

function HistogramMiniChart({
  distribution,
  field,
  width,
}: {
  distribution: HeaderHistogramDistribution;
  field: Field;
  width: number;
}) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);
  const config = useMemo(() => buildHeaderHistogramConfig(distribution, theme), [distribution, theme]);
  const data = useMemo<AlignedData>(() => [distribution.x, distribution.counts], [distribution]);
  const startLabel = formatEndpoint(field, distribution.min);
  const endLabel = formatEndpoint(field, distribution.max);

  return (
    <div className={styles.histogram} data-header-histogram-content="">
      <UPlotChart data={data} config={config} width={width} height={TABLE.HEADER_HISTOGRAM_HEIGHT} />
      <div className={styles.histogramLabels}>
        <span data-histogram-endpoint="start" title={startLabel}>
          {startLabel}
        </span>
        <span data-histogram-endpoint="end" title={endLabel}>
          {endLabel}
        </span>
      </div>
    </div>
  );
}

function CategoryMiniChart({ distribution, width }: { distribution: HeaderCategoryDistribution; width: number }) {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  return (
    <div className={styles.categoryBar}>
      {distribution.segments.map((segment, index) => {
        const background =
          segment.type === 'null'
            ? theme.colors.action.disabledBackground
            : segment.type === 'other'
              ? theme.colors.text.disabled
              : theme.visualization.getColorByName(CATEGORY_COLORS[index % CATEGORY_COLORS.length]);
        const showLabel = (width * segment.count) / distribution.totalCount >= MIN_CATEGORY_LABEL_WIDTH;

        return (
          <span
            key={`${segment.type}-${segment.label}`}
            data-segment-count={segment.count}
            data-segment-label={segment.label}
            data-segment-label-visible={showLabel}
            style={{ background, color: theme.colors.getContrastText(background), flexGrow: segment.count }}
          >
            {showLabel ? segment.label : null}
          </span>
        );
      })}
    </div>
  );
}

export const HeaderMiniChart = memo(function HeaderMiniChart({ distribution, field, width }: HeaderMiniChartProps) {
  const styles = useStyles2(getStyles);

  if (width <= 0) {
    return null;
  }

  return (
    <div
      aria-hidden="true"
      className={styles.root}
      data-table-header-visualization={distribution.kind}
      style={{ width }}
    >
      {distribution.kind === 'histogram' ? (
        <HistogramMiniChart distribution={distribution} field={field} width={width} />
      ) : (
        <CategoryMiniChart distribution={distribution} width={width} />
      )}
    </div>
  );
});

const getStyles = (theme: GrafanaTheme2) => ({
  root: css({
    height: TABLE.HEADER_VISUALIZATION_HEIGHT,
    minWidth: 0,
    maxWidth: '100%',
    boxSizing: 'border-box',
    paddingBlock: TABLE.HEADER_VISUALIZATION_VERTICAL_PADDING,
    overflow: 'hidden',
    pointerEvents: 'none',
    '& .uplot': {
      pointerEvents: 'none',
    },
  }),
  histogram: css({
    display: 'flex',
    flexDirection: 'column',
    gap: TABLE.HEADER_VISUALIZATION_CONTENT_GAP,
    width: '100%',
    minWidth: 0,
    pointerEvents: 'none',
  }),
  categoryBar: css({
    display: 'flex',
    alignItems: 'stretch',
    width: '100%',
    height: TABLE.HEADER_HISTOGRAM_HEIGHT,
    marginTop:
      (TABLE.HEADER_VISUALIZATION_HEIGHT -
        TABLE.HEADER_HISTOGRAM_HEIGHT -
        2 * TABLE.HEADER_VISUALIZATION_VERTICAL_PADDING) /
      2,
    overflow: 'hidden',
    borderRadius: theme.shape.radius.default,
    background: theme.colors.action.disabledBackground,
    gap: 1,
    pointerEvents: 'none',
    '& > span': {
      display: 'block',
      flexBasis: 0,
      minWidth: 1,
      overflow: 'hidden',
      padding: `0 ${theme.spacing(0.5)}`,
      fontSize: theme.typography.bodySmall.fontSize,
      fontWeight: theme.typography.fontWeightMedium,
      lineHeight: `${TABLE.HEADER_HISTOGRAM_HEIGHT}px`,
      textAlign: 'center',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      pointerEvents: 'none',
    },
  }),
  histogramLabels: css({
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
    alignItems: 'center',
    width: '100%',
    height:
      TABLE.HEADER_VISUALIZATION_HEIGHT -
      TABLE.HEADER_HISTOGRAM_HEIGHT -
      TABLE.HEADER_VISUALIZATION_CONTENT_GAP -
      2 * TABLE.HEADER_VISUALIZATION_VERTICAL_PADDING,
    color: theme.colors.text.secondary,
    fontSize: theme.typography.bodySmall.fontSize,
    lineHeight: 1,
    pointerEvents: 'none',
    '& > span': {
      minWidth: 0,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
      textAlign: 'left',
      pointerEvents: 'none',
    },
    '& > span:last-child': {
      textAlign: 'right',
    },
  }),
});
