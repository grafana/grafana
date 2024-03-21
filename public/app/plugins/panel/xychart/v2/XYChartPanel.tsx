import { css } from '@emotion/css';
import React, { useMemo } from 'react';

import { PanelProps } from '@grafana/data';
import { alpha } from '@grafana/data/src/themes/colorManipulator';
import { config } from '@grafana/runtime';
import {
  TooltipDisplayMode,
  TooltipPlugin2,
  UPlotChart,
  VizLayout,
  VizLegend,
  VizLegendItem,
  useStyles2,
} from '@grafana/ui';
import { TooltipHoverMode } from '@grafana/ui/src/components/uPlot/plugins/TooltipPlugin2';

import { Options } from '../types2';

import { XYChartTooltip } from './XYChartTooltip';
import { prepConfig } from './scatter';
import { prepSeries } from './utils';

type Props2 = PanelProps<Options>;

export const XYChartPanel2 = (props: Props2) => {
  const styles = useStyles2(getStyles);

  let { mapping, series: mappedSeries } = props.options;

  // regenerate series schema when mappings or data changes
  let series = useMemo(
    () => prepSeries(mapping, mappedSeries, props.data.series, props.fieldConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapping, mappedSeries, props.data.series, props.fieldConfig]
  );

  // if series changed due to mappings or data structure, re-init config & renderers
  let { builder, prepData } = useMemo(
    () => prepConfig(series, config.theme2),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapping, mappedSeries, props.data.structureRev, props.fieldConfig]
  );

  // generate data struct for uPlot mode: 2
  let data = useMemo(
    () => prepData(series),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [series]
  );

  // todo: handle errors
  let error = builder == null || data.length === 0 ? 'Err' : '';

  // TODO: React.memo()
  const renderLegend = () => {
    const items: VizLegendItem[] = [];

    series.forEach((s, idx) => {
      let yField = s.y.field;
      let config = yField.config;
      let custom = config.custom;

      if (!custom.hideFrom?.legend) {
        items.push({
          yAxis: 1, // TODO: pull from y field
          label: s.name.value,
          color: alpha(s.color.fixed!, 1),
          getItemKey: () => `${idx}-${s.name.value}`,
          fieldName: yField.state?.displayName ?? yField.name,
          disabled: yField.state?.hideFrom?.viz ?? false,
        });
      }
    });

    // sort series by calcs? table mode?

    const { placement, displayMode, width } = props.options.legend;

    return (
      <VizLayout.Legend placement={placement} width={width}>
        <VizLegend className={styles.legend} placement={placement} items={items} displayMode={displayMode} />
      </VizLayout.Legend>
    );
  };

  if (error) {
    return (
      <div className="panel-empty">
        <p>{error}</p>
      </div>
    );
  }

  return (
    <VizLayout width={props.width} height={props.height} legend={renderLegend()}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart config={builder!} data={data} width={vizWidth} height={vizHeight}>
          {props.options.tooltip.mode !== TooltipDisplayMode.None && (
            <TooltipPlugin2
              config={builder!}
              hoverMode={TooltipHoverMode.xyOne}
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss) => {
                return (
                  <XYChartTooltip
                    data={props.data.series}
                    dataIdxs={dataIdxs}
                    xySeries={series}
                    dismiss={dismiss}
                    isPinned={isPinned}
                    seriesIdx={seriesIdx!}
                  />
                );
              }}
              maxWidth={props.options.tooltip.maxWidth}
              maxHeight={props.options.tooltip.maxHeight}
            />
          )}
        </UPlotChart>
      )}
    </VizLayout>
  );
};

const getStyles = () => ({
  legend: css({
    div: {
      justifyContent: 'flex-start',
    },
  }),
});
