import { css } from '@emotion/css';
import React from 'react';

import { formattedValueToString, getFieldDisplayName, GrafanaTheme2 } from '@grafana/data';
import { HeatmapCellLayout } from '@grafana/schema/dist/esm/common/common.gen';
import { useStyles2 } from '@grafana/ui';
import { ColorScale } from 'app/core/components/ColorScale/ColorScale';
import { readHeatmapRowsCustomMeta } from 'app/features/transformers/calculateHeatmap/heatmap';
import { DataHoverView } from 'app/features/visualization/data-hover/DataHoverView';

import { HeatmapData } from '../fields';

import { VizTooltipHeader } from './VizTooltipHeader';
import { ColorIndicator, getHoverCellColor, LabelValue } from './tooltipUtils';

interface Props {
  dataIdxs: Array<number | null>;
  seriesIdx: number | null | undefined;
  data: HeatmapData;
  isPinned: boolean;
  onClose: () => void;
}

export const HeatmapTooltip = (props: Props) => {
  // exemplars
  if (props.seriesIdx === 2) {
    return <DataHoverView data={props.data.exemplars} rowIndex={props.dataIdxs[2]} header={'Exemplar'} />;
  }

  return <HeatmapTooltipHover {...props} />;
};
const HeatmapTooltipHover = ({ dataIdxs, seriesIdx, isPinned, data, onClose }: Props) => {
  const styles = useStyles2(getStyles);

  const index = dataIdxs[1]!;

  const xField = data.heatmap?.fields[0];
  const yField = data.heatmap?.fields[1];
  const countField = data.heatmap?.fields[2];

  const xVals = xField?.values;
  const yVals = yField?.values;
  const countVals = countField?.values;

  // labeled buckets
  const meta = readHeatmapRowsCustomMeta(data.heatmap);
  const yDisp = yField?.display ? (v: string) => formattedValueToString(yField.display!(v)) : (v: string) => `${v}`;

  const yValueIdx = index % data.yBucketCount! ?? 0;

  let yBucketMin: string;
  let yBucketMax: string;

  let nonNumericOrdinalDisplay: string | undefined = undefined;

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

  let xBucketMin: number;
  let xBucketMax: number;

  if (data.xLayout === HeatmapCellLayout.le) {
    xBucketMax = xVals?.[index];
    xBucketMin = xBucketMax - data.xBucketSize!;
  } else {
    xBucketMin = xVals?.[index];
    xBucketMax = xBucketMin + data.xBucketSize!;
  }

  const count = countVals?.[index];

  const { cellColor, colorPalette } = getHoverCellColor(data, index);

  const getLabelValue = (): LabelValue[] => {
    return [
      {
        label: getFieldDisplayName(countField!, data.heatmap),
        value: data.display!(count),
        color: cellColor ?? '#FFF',
        colorIndicator: ColorIndicator.value,
      },
    ];
  };

  const getHeaderLabel = (): LabelValue => {
    if (nonNumericOrdinalDisplay) {
      return { label: 'Name', value: nonNumericOrdinalDisplay };
    }

    switch (data.yLayout) {
      case HeatmapCellLayout.unknown:
        return { label: '', value: yDisp(yBucketMin) };
    }

    return {
      label: 'Bucket',
      value: `${yDisp(yBucketMin)}` + '-' + `${yDisp(yBucketMax)}`,
    };
  };

  const getCustomValueDisplay = () => {
    if (colorPalette) {
      return (
        <ColorScale
          colorPalette={colorPalette}
          min={data.heatmapColors?.minValue!}
          max={data.heatmapColors?.maxValue!}
          display={data.display}
          hoverValue={count}
        />
      );
    }

    return null;
  };

  return (
    <div className={styles.wrapper}>
      <VizTooltipHeader
        showCloseButton={isPinned}
        headerLabel={getHeaderLabel()}
        keyValuePairs={getLabelValue()}
        // customValueDisplay={getCustomValueDisplay()}
        onClose={onClose}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  wrapper: css`
    width: 280px;
    display: flex;
    align-items: flex-start;
    padding: ${theme.spacing(1)};
  `,
});
