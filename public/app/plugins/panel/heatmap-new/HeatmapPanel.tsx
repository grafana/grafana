import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ArrayVector,
  DataFrame,
  Field,
  formattedValueToString,
  PanelProps,
  reduceField,
  ReducerID,
  TimeRange,
  ValueLinkConfig,
} from '@grafana/data';
import { Portal, UPlotChart, useTheme2, VizLayout, LegendDisplayMode, usePanelContext } from '@grafana/ui';
import { PanelDataErrorView } from '@grafana/runtime';

import { HeatmapData, prepareHeatmapData } from './fields';
import { PanelOptions } from './models.gen';
import { quantizeScheme } from './palettes';
import {
  findExemplarFrameInPanelData,
  findDataFramesInPanelData,
  HeatmapHoverEvent,
  prepConfig,
  timeFormatter,
} from './utils';
import { HeatmapHoverView } from './HeatmapHoverView';
import { ColorScale } from './ColorScale';
import { ExemplarsPlugin } from './plugins/ExemplarsPlugin';
import { getFieldLinksForExplore } from 'app/features/explore/utils/links';
import { HeatmapCalculationMode } from 'app/features/transformers/calculateHeatmap/models.gen';
import { HeatmapLookup } from './types';
import { heatmapLayer } from './layers/HeatmapLayer';
import { exemplarLayer } from './layers/ExemplarLayer';

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

  // ugh
  let timeRangeRef = useRef<TimeRange>(timeRange);
  timeRangeRef.current = timeRange;

  const info = useMemo(
    () => prepareHeatmapData(findDataFramesInPanelData(data), options, theme),
    [data, options, theme]
  );
  const exemplars: HeatmapData | undefined = useMemo((): HeatmapData | undefined => {
    const exemplarsFrame: DataFrame | undefined = findExemplarFrameInPanelData(data);
    if (exemplarsFrame) {
      return prepareHeatmapData(
        [exemplarsFrame],
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
  const facets = useMemo(() => [null, info.heatmap?.fields.map((f) => f.values.toArray())], [info.heatmap]);
  const { onSplitOpen } = usePanelContext();

  //console.log(facets);

  const palette = useMemo(() => quantizeScheme(options.color, theme), [options.color, theme]);

  const [hover, setHover] = useState<HeatmapHoverEvent | undefined>(undefined);
  const isToolTipOpen = useRef<boolean>(false);

  const onCloseToolTip = () => {
    isToolTipOpen.current = false;
    onhover(null);
  };

  const onclick = () => {
    isToolTipOpen.current = !isToolTipOpen.current;
  };

  const onhover = useCallback(
    (evt?: HeatmapHoverEvent | null) => {
      setHover(evt ?? undefined);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, data.structureRev]
  );

  // ugh
  const dataRef = useRef<HeatmapData>(info);
  dataRef.current = info;

  const builder = useMemo(() => {
    return prepConfig({
      dataRef,
      theme,
      onhover: options.tooltip.show ? onhover : null,
      onclick: options.tooltip.show ? onclick : null,
      onzoom: (evt) => {
        onChangeTimeRange({ from: evt.xMin, to: evt.xMax });
      },
      isToolTipOpen,
      timeZone,
      getTimeRange: () => timeRangeRef.current,
      palette,
      cellGap: options.cellGap,
      hideThreshold: options.hideThreshold,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [options, data.structureRev]);

  const getValuesInCell = (lookupRange: HeatmapLookup): DataFrame[] | undefined => {
    const timeField: Field | undefined = data.annotations?.[0].fields.find((f: Field) => f.type === 'time');
    const valueField: Field | undefined = data.annotations?.[0].fields.find((f: Field) => f.type === 'number');
    if (timeField && valueField) {
      const minIndex: number = timeField.values
        .toArray()
        .findIndex((value: number) => value >= lookupRange.xRange.min!);
      const count: number = timeField.values
        .toArray()
        .slice(minIndex)
        .findIndex((value: number) => value >= lookupRange.xRange.max!);

      // Now find the relevant values in the value field.
      const indicies: number[] = valueField.values
        .toArray()
        .slice(minIndex, minIndex + count)
        .reduce((tally: number[], curr: number, i: number) => {
          if (curr >= lookupRange.yRange?.min! && curr < lookupRange.yRange?.max!) {
            tally.push(i + minIndex);
          }
          return tally;
        }, []);

      return indicies.map((annotationIndex: number, index: number) => {
        return {
          name: `${index}`,
          fields: (data.annotations?.[0].fields || []).map((f: Field, rowIndex: number) => {
            const newField: Field = {
              ...f,
              values: new ArrayVector([f.values.get(annotationIndex)]),
            };
            if (f.config.links?.length) {
              // We have links to configure. Add a getLinks function to the field
              newField.getLinks = (config: ValueLinkConfig) => {
                return getFieldLinksForExplore({ field: f, rowIndex, splitOpenFn: onSplitOpen, range: timeRange });
              };
            }
            if (f.type === 'time') {
              newField.display = (value: number) => {
                return {
                  numeric: value,
                  text: timeFormatter(value, timeZone),
                };
              };
            }
            return newField;
          }),
          length: 1,
        };
      });
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
            {exemplars && (
              <ExemplarsPlugin
                config={builder}
                exemplars={exemplars}
                timeZone={timeZone}
                getValuesInCell={getValuesInCell}
              />
            )}
          </UPlotChart>
        )}
      </VizLayout>
      <Portal>
        {hover && (
          <HeatmapHoverView
            ttip={{
              layers: [
                heatmapLayer({ data: info, index: hover.index }),
                exemplarLayer({ data: exemplars!, index: hover.index }),
              ],
              hover,
              point: {},
            }}
            isOpen={isToolTipOpen.current}
            onClose={onCloseToolTip}
          />
        )}
      </Portal>
    </>
  );
};
