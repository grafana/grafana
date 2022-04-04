import React, { useCallback, useMemo, useRef, useState } from 'react';
import { css } from '@emotion/css';
import {
  Field,
  formattedValueToString,
  GrafanaTheme2,
  PanelProps,
  reduceField,
  ReducerID,
  dateTime,
} from '@grafana/data';
import {
  Portal,
  UPlotChart,
  useStyles2,
  useTheme2,
  VizLayout,
  VizTooltipContainer,
  LegendDisplayMode,
  usePanelContext,
} from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';

import { HeatmapData, prepareHeatmapData } from './fields';
import { PanelOptions } from './models.gen';
import { quantizeScheme } from './palettes';
import { HeatmapHoverEvent, prepConfig } from './utils';
import { HeatmapHoverView } from './HeatmapHoverView';
import { CloseButton } from 'app/core/components/CloseButton/CloseButton';
import { ColorScale } from './ColorScale';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { HeatmapCalculationMode } from 'app/features/transformers/calculateHeatmap/models.gen';

interface HeatmapPanelProps extends PanelProps<PanelOptions> {}

export const HeatmapPanel: React.FC<HeatmapPanelProps> = ({
  data,
  id,
  timeRange,
  timeZone,
  width,
  height,
  options,
  fieldConfig,
  onChangeTimeRange,
  replaceVariables,
}) => {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  const info: HeatmapData = useMemo(() => prepareHeatmapData(data.series, options, theme), [data, options, theme]);
  const exemplars: HeatmapData | undefined = useMemo((): HeatmapData | undefined => {
    if (data.annotations) {
      return prepareHeatmapData(
        data.annotations,
        {
          ...options,
          heatmap: {
            yAxis: {
              mode: HeatmapCalculationMode.Size,
              value: info.yBucketSize?.toString(),
            },
          },
        },
        theme
      );
    }
    return undefined;
  }, [data, info, options, theme]);

  console.log('data.series', data.series, 'data.annotations', data.annotations, 'info', info, 'exemplars', exemplars);
  const facets = useMemo(() => [null, info.heatmap?.fields.map((f) => f.values.toArray())], [info.heatmap]);
  const { onSplitOpen } = usePanelContext();

  //console.log(facets);

  const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);

  const [hover, setHover] = useState<HeatmapHoverEvent | undefined>(undefined);
  const [shouldDisplayCloseButton, setShouldDisplayCloseButton] = useState<boolean>(false);
  const isToolTipOpen = useRef<boolean>(false);

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    setShouldDisplayCloseButton(false);
    onhover(null);
  };

  const onclick = () => {
    isToolTipOpen.current = !isToolTipOpen.current;

    // Linking into useState required to re-render tooltip
    setShouldDisplayCloseButton(isToolTipOpen.current);
  };

  const onhover = useCallback(
    (evt?: HeatmapHoverEvent | null) => {
      setHover(evt ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, data.structureRev]
  );

  const dataRef = useRef<HeatmapData>(info);

  dataRef.current = info;

  const builder = useMemo(() => {
    return prepConfig({
      dataRef,
      theme,
      onhover: options.tooltip.show ? onhover : () => {},
      onclick: options.tooltip.show ? onclick : () => {},
      isToolTipOpen,
      timeZone,
      timeRange,
      palette,
      cellGap: options.cellGap,
      hideThreshold: options.hideThreshold,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data.structureRev]);
  console.log('builder', builder);

  const getFieldLinks = (xField: Field, yField: Field, count: number, row: number) => {
    // Find the timerange for this cell
    if (xField.type !== 'time') {
      console.error('Only time supported for xFields. Got', xField.type);
      return undefined;
    }

    const xMatch: Field | undefined = exemplars?.heatmap?.fields.find((f) => f.name === xField.name);
    const yMatch: Field | undefined = exemplars?.heatmap?.fields.find((f) => f.name === yField.name);

    if (yMatch && xMatch && exemplars) {
      const xOrig = data.series[0].fields.find((f) => f.name === xMatch.config.custom.originalName);
      // Get the indicies in the original data. Then use that to find the proper
      console.log('xOrig', xOrig, 'data', data, 'row', row);
      console.log(
        'row time',
        xMatch.values.get(row),
        'start time',
        dateTime(data.request?.startTime!).format(),
        'end time',
        dateTime(data.request?.endTime!).format(),
        'diff',
        xMatch.values.get(row) - data.request?.startTime!
      );
      const startIndex = (xMatch.values.get(row) - data.request?.startTime!) / data.request?.intervalMs!;
      const endIndex =
        (xMatch?.values.get(row) + exemplars?.xBucketSize - data.request?.startTime!) / data.request?.intervalMs!;
      console.log('startIndex', startIndex, 'endIndex', endIndex);
      return getFieldLinksForExplore({ field: yField, rowIndex: row, splitOpenFn: onSplitOpen, range: timeRange });
    }
    return undefined;
  };

  const renderLegend = () => {
    if (options.legend.displayMode === LegendDisplayMode.Hidden || !info.heatmap) {
      return null;
    }

    const field = info.heatmap.fields[2];
    const { min, max } = reduceField({ field, reducers: [ReducerID.min, ReducerID.max] });
    const display = field.display ? (v: number) => formattedValueToString(field.display!(v)) : (v: number) => `${v}`;

    let hoverValue: number | undefined = undefined;
    if (hover && info.heatmap.fields) {
      const countField = info.heatmap.fields[2];
      hoverValue = countField?.values.get(hover.index);
    }

    return (
      <VizLayout.Legend placement="bottom" maxHeight="20%">
        <ColorScale hoverValue={hoverValue} colorPalette={palette} min={min} max={max} display={display} />
      </VizLayout.Legend>
    );
  };

  if (info.warning || !info.heatmap) {
    return <PanelDataErrorView panelId={id} data={data} needsNumberField={true} message={info.warning} />;
  }

  return (
    <>
      <VizLayout width={width} height={height} legend={renderLegend()}>
        {(vizWidth: number, vizHeight: number) => (
          <UPlotChart config={builder} data={facets as any} width={vizWidth} height={vizHeight} timeRange={timeRange}>
            {/*children ? children(config, alignedFrame) : null*/}
            {exemplars && (
              <ExemplarsPlugin
                config={builder}
                exemplars={exemplars}
                timeZone={timeZone}
                getFieldLinks={getFieldLinks}
              />
            )}
          </UPlotChart>
        )}
      </VizLayout>
      <Portal>
        {hover && (
          <VizTooltipContainer
            position={{ x: hover.pageX, y: hover.pageY }}
            offset={{ x: 10, y: 10 }}
            allowPointerEvents={isToolTipOpen.current}
          >
            {shouldDisplayCloseButton && (
              <>
                <CloseButton onClick={onCloseToolTip} />
                <div className={styles.closeButtonSpacer} />
              </>
            )}
            <HeatmapHoverView data={info} hover={hover} showHistogram={options.tooltip.yHistogram} />
          </VizTooltipContainer>
        )}
      </Portal>
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  closeButtonSpacer: css`
    margin-bottom: 15px;
  `,
});
