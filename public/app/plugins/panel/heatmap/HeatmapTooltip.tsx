import { ReactElement, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import * as React from 'react';
import uPlot from 'uplot';

import {
  ActionModel,
  Field,
  FieldType,
  formattedValueToString,
  getFieldDisplayName,
  InterpolateFunction,
  LinkModel,
  PanelData,
} from '@grafana/data';
import { HeatmapCellLayout } from '@grafana/schema';
import { TextLink, TooltipDisplayMode, useTheme2 } from '@grafana/ui';
import {
  VizTooltipContent,
  VizTooltipFooter,
  VizTooltipHeader,
  VizTooltipWrapper,
  VizTooltipItem,
  ColorIndicator,
  ColorPlacement,
} from '@grafana/ui/internal';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { getDashboardSrv } from 'app/features/dashboard/services/DashboardSrv';
import { ExploreSplitOpenContext } from 'app/features/explore/Heatmap/HeatmapExploreContainer';
import { readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';

import { getDataLinks, getFieldActions } from '../status-history/utils';
import { isTooltipScrollable } from '../timeseries/utils';

import { HeatmapData } from './fields';
import { renderHistogram } from './renderHistogram';
import {
  formatMilliseconds,
  getFieldFromData,
  getHoverCellColor,
  getSparseCellMinMax,
  isHeatmapSparse,
} from './tooltip/utils';

interface HeatmapTooltipProps {
  mode: TooltipDisplayMode;
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  dataRef: React.MutableRefObject<HeatmapData>;
  showHistogram?: boolean;
  showColorScale?: boolean;
  isPinned: boolean;
  dismiss: () => void;
  panelData: PanelData;
  annotate?: () => void;
  maxHeight?: number;
  maxWidth?: number;
  replaceVariables: InterpolateFunction;
  canExecuteActions?: boolean;
}

// Custom exemplar tooltip that renders field values with inline links
const HeatmapExemplarTooltip = ({
  exemplarFrame,
  rowIndex,
  isPinned,
  maxHeight,
}: {
  exemplarFrame: PanelData['series'][0];
  rowIndex: number;
  isPinned: boolean;
  maxHeight?: number;
}) => {
  const { splitOpen, timeRange } = useContext(ExploreSplitOpenContext);

  // Get visible fields (excluding private labels starting with __)
  const visibleFields = exemplarFrame.fields.filter(
    (f) => !Boolean(f.config.custom?.hideFrom?.tooltip) && !f.name.startsWith('__')
  );

  if (visibleFields.length === 0) {
    return null;
  }

  // Find time field
  const timeField = visibleFields.find((f) => f.name === 'Time');
  const timeValue = timeField
    ? formattedValueToString(
        timeField.display ? timeField.display(timeField.values[rowIndex]) : { text: `${timeField.values[rowIndex]}` }
      )
    : '';

  // Prepare fields to display (excluding time)
  const displayFields = visibleFields.filter((f) => f !== timeField);

  const theme = useTheme2();

  // Helper to check if this is a Span ID field (not Profile ID)
  const isSpanIdField = (field: Field) => {
    return field.config.displayName === 'Span ID';
  };

  // Helper to check if a label name needs quoting
  // Label names with non-alphanumeric characters (except _) need to be quoted
  const needsQuoting = (labelName: string): boolean => {
    // Valid unquoted label names: start with letter or underscore, followed by alphanumeric or underscore
    return !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(labelName);
  };

  // Helper to quote a label name if needed
  const quoteLabelName = (labelName: string): string => {
    if (needsQuoting(labelName)) {
      // Escape any quotes in the label name itself, then wrap in quotes
      return `"${labelName.replace(/"/g, '\\"')}"`;
    }
    return labelName;
  };

  // Helper to escape label values for Pyroscope label selector
  // Need to escape backslashes and quotes
  const escapeLabelValue = (value: string): string => {
    return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  };

  // Helper to manually generate Explore query for span profile
  const handleSpanIdClick = (spanId: string) => {
    if (!splitOpen || !timeRange) {
      return;
    }

    // Extract profileTypeId from __profile_type__ field
    const profileTypeField = exemplarFrame.fields.find((f) => f.name === '__profile_type__');
    const profileTypeId = profileTypeField ? String(profileTypeField.values[rowIndex]) : '';

    // Collect all label fields (excluding Time, Value, Id, and private labels starting with __)
    const labelFields = exemplarFrame.fields.filter(
      (f) => f.name !== 'Time' && f.name !== 'Value' && f.name !== 'Id' && !f.name.startsWith('__')
    );

    // Build label selector with properly escaped values and quoted label names if needed
    // Format: {label1="value1", "label-2"="value2", ...}
    const labelParts = labelFields.map((field) => {
      const value = field.values[rowIndex];
      const quotedLabelName = quoteLabelName(field.name);
      const escapedValue = escapeLabelValue(String(value));
      return `${quotedLabelName}="${escapedValue}"`;
    });
    const labelSelector = labelParts.length > 0 ? `{${labelParts.join(', ')}}` : '';

    // Get timestamp from Time field and create a narrow time window around it (+/- 30 seconds)
    const timeMs = timeField?.values[rowIndex];
    const timestamp = timeMs instanceof Date ? timeMs.getTime() : timeMs;

    // Create a 60-second window centered on the exemplar (30s before and after)
    const windowMs = 30 * 1000; // 30 seconds in milliseconds
    const narrowRange = {
      from: new Date(timestamp - windowMs).toISOString(),
      to: new Date(timestamp + windowMs).toISOString(),
    };

    // Construct the query for span profile
    const query = {
      queryType: 'profile',
      spanSelector: [spanId],
      labelSelector,
      profileTypeId,
      groupBy: [],
    };

    // Open in explore with the span profile query and narrow time range
    splitOpen({
      queries: [query],
      range: narrowRange,
    });
  };

  return (
    <VizTooltipWrapper>
      <VizTooltipHeader
        item={{
          label: 'Exemplar',
          value: timeValue,
        }}
        isPinned={isPinned}
      />
      <VizTooltipContent items={[]} isPinned={isPinned} maxHeight={maxHeight} scrollable={maxHeight != null}>
        <div style={{ padding: `${theme.spacing(1)} 0` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {displayFields.map((field, i) => {
                const value = field.values[rowIndex];
                const fieldDisplay = field.display ? field.display(value) : { text: `${value}`, numeric: +value };
                const fieldName = getFieldDisplayName(field, exemplarFrame);
                const valueString = formattedValueToString(fieldDisplay);

                // Check if this is a Span ID field that should have a link
                const isSpanId = isSpanIdField(field);
                const hasLink = isSpanId && splitOpen;

                return (
                  <tr key={i}>
                    <td
                      style={{
                        padding: `${theme.spacing(0.25)} ${theme.spacing(2)} ${theme.spacing(0.25)} 0`,
                        fontWeight: theme.typography.fontWeightMedium,
                      }}
                    >
                      {fieldName}:
                    </td>
                    <td style={{ padding: `${theme.spacing(0.25)} 0` }}>
                      {hasLink ? (
                        <TextLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            handleSpanIdClick(valueString);
                          }}
                          external={false}
                          weight="medium"
                          inline={false}
                        >
                          {valueString}
                        </TextLink>
                      ) : (
                        valueString
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </VizTooltipContent>
    </VizTooltipWrapper>
  );
};

export const HeatmapTooltip = (props: HeatmapTooltipProps) => {
  if (props.seriesIdx === 2) {
    const exemplarFrame = props.dataRef.current!.exemplars!;
    const rowIndex = props.dataIdxs[2]!;

    return (
      <HeatmapExemplarTooltip
        exemplarFrame={exemplarFrame}
        rowIndex={rowIndex}
        isPinned={props.isPinned}
        maxHeight={props.maxHeight}
      />
    );
  }

  return <HeatmapHoverCell {...props} />;
};

const defaultHistogramWidth = 264;
const defaultHistogramHeight = 64;

const HeatmapHoverCell = ({
  dataIdxs,
  dataRef,
  showHistogram,
  isPinned,
  showColorScale = false,
  mode,
  annotate,
  maxHeight,
  maxWidth,
  replaceVariables,
  canExecuteActions,
}: HeatmapTooltipProps) => {
  const index = dataIdxs[1]!;
  const data = dataRef.current;

  const [isSparse] = useState(() => isHeatmapSparse(data.heatmap));

  const xField = getFieldFromData(data.heatmap!, 'x', isSparse)!;
  const yField = getFieldFromData(data.heatmap!, 'y', isSparse)!;
  const countField = getFieldFromData(data.heatmap!, 'count', isSparse)!;

  const xDisp = (v: number) => {
    if (xField?.display) {
      return formattedValueToString(xField.display(v));
    }
    if (xField?.type === FieldType.time) {
      const tooltipTimeFormat = 'YYYY-MM-DD HH:mm:ss';
      const dashboard = getDashboardSrv().getCurrent();
      return dashboard?.formatDate(v, tooltipTimeFormat);
    }
    return `${v}`;
  };

  const xVals = xField.values;
  const yVals = yField.values;
  const countVals = countField.values;

  // labeled buckets
  const meta = readHeatmapRowsCustomMeta(data.heatmap);
  const yDisp = yField?.display ? (v: string) => formattedValueToString(yField.display!(v)) : (v: string) => `${v}`;

  let interval = xField?.config.interval;

  let yBucketMin: string;
  let yBucketMax: string;

  let xBucketMin: number;
  let xBucketMax: number;

  let nonNumericOrdinalDisplay: string | undefined = undefined;

  let contentItems: VizTooltipItem[] = [];

  const getYValueIndex = (idx: number) => {
    return idx % (data.yBucketCount ?? 1);
  };

  let yValueIdx = getYValueIndex(index);
  const xValueIdx = Math.floor(index / (data.yBucketCount ?? 1));

  const getData = (idx: number = index) => {
    if (meta.yOrdinalDisplay) {
      const yMinIdx = data.yLayout === HeatmapCellLayout.le ? yValueIdx - 1 : yValueIdx;
      const yMaxIdx = data.yLayout === HeatmapCellLayout.le ? yValueIdx : yValueIdx + 1;
      yBucketMin = yMinIdx < 0 ? meta.yMinDisplay! : `${meta.yOrdinalDisplay[yMinIdx]}`;
      yBucketMax = `${meta.yOrdinalDisplay[yMaxIdx]}`;

      // e.g. "pod-xyz123"
      if (!meta.yOrdinalLabel || Number.isNaN(+meta.yOrdinalLabel[0])) {
        nonNumericOrdinalDisplay = data.yLayout === HeatmapCellLayout.le ? yBucketMax : yBucketMin;
      }
    } else {
      const value = yVals?.[yValueIdx];

      if (data.yLayout === HeatmapCellLayout.le) {
        yBucketMax = `${value}`;

        if (data.yLog) {
          let logFn = data.yLog === 2 ? Math.log2 : Math.log10;
          let exp = logFn(value) - 1 / data.yLogSplit!;
          yBucketMin = `${data.yLog ** exp}`;
        } else {
          yBucketMin = `${value - data.yBucketSize!}`;
        }
      } else {
        yBucketMin = `${value}`;

        if (data.yLog) {
          let logFn = data.yLog === 2 ? Math.log2 : Math.log10;
          let exp = logFn(value) + 1 / data.yLogSplit!;
          yBucketMax = `${data.yLog ** exp}`;
        } else {
          yBucketMax = `${value + data.yBucketSize!}`;
        }
      }
    }

    if (data.xLayout === HeatmapCellLayout.le) {
      xBucketMax = xVals[idx];
      xBucketMin = xBucketMax - data.xBucketSize!;
    } else {
      xBucketMin = xVals[idx];
      xBucketMax = xBucketMin + data.xBucketSize!;
    }
  };

  if (isSparse) {
    ({ xBucketMin, xBucketMax, yBucketMin, yBucketMax } = getSparseCellMinMax(data!, index));
  } else {
    getData();
  }

  const { cellColor, colorPalette } = getHoverCellColor(data, index);

  const getDisplayData = (fromIdx: number, toIdx: number) => {
    let vals = [];
    for (let idx = fromIdx; idx <= toIdx; idx++) {
      if (!countVals?.[idx]) {
        continue;
      }

      const color = getHoverCellColor(data, idx).cellColor;
      count = getCountValue(idx);

      if (isSparse) {
        ({ xBucketMin, xBucketMax, yBucketMin, yBucketMax } = getSparseCellMinMax(data!, idx));
      } else {
        yValueIdx = getYValueIndex(idx);
        getData(idx);
      }

      const { label, value } = getContentLabels()[0];

      vals.push({
        label,
        value,
        color: color ?? '#FFF',
        isActive: index === idx,
      });
    }

    return vals;
  };

  const getContentLabels = (): VizTooltipItem[] => {
    const isMulti = mode === TooltipDisplayMode.Multi && !isPinned;

    if (nonNumericOrdinalDisplay) {
      return isMulti
        ? [{ label: `Name ${nonNumericOrdinalDisplay}`, value: data.display!(count) }]
        : [{ label: 'Name', value: nonNumericOrdinalDisplay }];
    }

    switch (data.yLayout) {
      case HeatmapCellLayout.unknown:
        return isMulti
          ? [{ label: yDisp(yBucketMin), value: data.display!(count) }]
          : [{ label: '', value: yDisp(yBucketMin) }];
    }

    return isMulti
      ? [
          {
            label: `Bucket ${yDisp(yBucketMin)}` + '-' + `${yDisp(yBucketMax)}`,
            value: data.display!(count),
          },
        ]
      : [
          {
            label: 'Bucket',
            value: `${yDisp(yBucketMin)}` + '-' + `${yDisp(yBucketMax)}`,
          },
        ];
  };

  const getCountValue = (idx: number) => {
    return countVals?.[idx];
  };

  let count = getCountValue(index);

  if (mode === TooltipDisplayMode.Single || isPinned) {
    const fromToInt: VizTooltipItem[] = interval ? [{ label: 'Duration', value: formatMilliseconds(interval) }] : [];

    contentItems = [
      {
        label: getFieldDisplayName(countField, data.heatmap),
        value: data.display!(count),
        color: cellColor ?? '#FFF',
        colorPlacement: ColorPlacement.trailing,
        colorIndicator: ColorIndicator.value,
      },
      ...getContentLabels(),
      ...fromToInt,
    ];
  }

  if (mode === TooltipDisplayMode.Multi && !isPinned) {
    let xVal = xField.values[index];
    let fromIdx = index;
    let toIdx = index;

    while (xField.values[fromIdx - 1] === xVal) {
      fromIdx--;
    }

    while (xField.values[toIdx + 1] === xVal) {
      toIdx++;
    }

    const vals: VizTooltipItem[] = getDisplayData(fromIdx, toIdx);
    vals.forEach((val) => {
      contentItems.push({
        label: val.label,
        value: val.value,
        color: val.color ?? '#FFF',
        colorIndicator: ColorIndicator.value,
        colorPlacement: ColorPlacement.trailing,
        isActive: val.isActive,
      });
    });
  }

  let footer: ReactNode;

  if (isPinned) {
    let links: Array<LinkModel<Field>> = [];
    let actions: Array<ActionModel<Field>> = [];

    const linksField = data.series?.fields[yValueIdx + 1];

    if (linksField != null) {
      const visible = !Boolean(linksField.config.custom?.hideFrom?.tooltip);
      const hasLinks = (linksField.config.links?.length ?? 0) > 0;

      if (visible && hasLinks) {
        links = getDataLinks(linksField, xValueIdx);
      }

      actions = canExecuteActions
        ? getFieldActions(data.series!, linksField, replaceVariables, xValueIdx, 'heatmap')
        : [];
    }

    footer = <VizTooltipFooter dataLinks={links} annotate={annotate} actions={actions} />;
  }

  let can = useRef<HTMLCanvasElement>(null);

  const theme = useTheme2();
  const themeSpacing = parseInt(theme.spacing(1), 10);

  let histCssWidth = Math.min(defaultHistogramWidth, maxWidth ? maxWidth - themeSpacing * 2 : defaultHistogramWidth);
  let histCssHeight = defaultHistogramHeight;
  let histCanWidth = Math.round(histCssWidth * uPlot.pxRatio);
  let histCanHeight = Math.round(histCssHeight * uPlot.pxRatio);

  useEffect(
    () => {
      if (showHistogram && xVals != null && countVals != null && mode === TooltipDisplayMode.Single) {
        renderHistogram(can, histCanWidth, histCanHeight, xVals, countVals, index, data.yBucketCount!);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [index]
  );

  const headerItem: VizTooltipItem = {
    label: '',
    value: xDisp(xBucketMax!)!,
  };

  let customContent: ReactElement[] = [];

  if (mode === TooltipDisplayMode.Single) {
    // Histogram
    if (showHistogram && !isSparse) {
      customContent.push(
        <canvas
          width={histCanWidth}
          height={histCanHeight}
          ref={can}
          style={{ width: histCssWidth + 'px', height: histCssHeight + 'px' }}
        />
      );
    }

    // Color scale
    if (colorPalette && showColorScale) {
      customContent.push(
        <ColorScale
          colorPalette={colorPalette}
          min={data.heatmapColors?.minValue!}
          max={data.heatmapColors?.maxValue!}
          display={data.display}
          hoverValue={count}
        />
      );
    }
  }

  return (
    <VizTooltipWrapper>
      <VizTooltipHeader item={headerItem} isPinned={isPinned} />
      <VizTooltipContent
        items={contentItems}
        isPinned={isPinned}
        scrollable={isTooltipScrollable({ mode, maxHeight })}
        maxHeight={maxHeight}
      >
        {customContent?.map((content, i) => (
          <div key={i} style={{ padding: `${theme.spacing(1)} 0` }}>
            {content}
          </div>
        ))}
      </VizTooltipContent>
      {footer}
    </VizTooltipWrapper>
  );
};
