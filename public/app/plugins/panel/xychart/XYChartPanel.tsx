import { css } from '@emotion/css';
import { useMemo } from 'react';

import { colorManipulator, FALLBACK_COLOR, PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  TooltipDisplayMode,
  TooltipPlugin2,
  UPlotChart,
  VizLayout,
  VizLegend,
  VizLegendItem,
  useStyles2,
  useTheme2,
} from '@grafana/ui';
import { getDisplayValuesForCalcs, TooltipHoverMode } from '@grafana/ui/internal';

import { getDataLinks } from '../status-history/utils';

import { XYChartTooltip } from './XYChartTooltip';
import { Options } from './panelcfg.gen';
import { prepConfig } from './scatter';
import { prepSeries } from './utils';

type Props2 = PanelProps<Options>;

export const XYChartPanel2 = (props: Props2) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

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
    [mapping, mappedSeries, props.data.structureRev, props.fieldConfig, props.options.tooltip]
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
    if (!props.options.legend.showLegend) {
      return null;
    }

    const items: VizLegendItem[] = [];

    series.forEach((s, idx) => {
      let yField = s.y.field;
      let config = yField.config;
      let custom = config.custom;

      if (!custom.hideFrom?.legend) {
        items.push({
          yAxis: 1, // TODO: pull from y field
          label: s.name.value,
          color: colorManipulator.alpha(s.color.fixed ?? FALLBACK_COLOR, 1),
          getItemKey: () => `${idx}-${s.name.value}`,
          fieldName: yField.state?.displayName ?? yField.name,
          disabled: yField.state?.hideFrom?.viz ?? false,
          getDisplayValues: () => getDisplayValuesForCalcs(props.options.legend.calcs, yField, theme),
        });
      }
    });

    const { placement, displayMode, width, sortBy, sortDesc } = props.options.legend;

    return (
      <VizLayout.Legend placement={placement} width={width}>
        <VizLegend
          className={styles.legend}
          placement={placement}
          items={items}
          displayMode={displayMode}
          sortBy={sortBy}
          sortDesc={sortDesc}
          isSortable={true}
        />
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
              getDataLinks={(seriesIdx, dataIdx) => {
                const xySeries = series[seriesIdx - 1];
                return getDataLinks(xySeries.y.field, dataIdx);
              }}
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2, viaSync, dataLinks) => {
                return (
                  <XYChartTooltip
                    data={props.data.series}
                    dataIdxs={dataIdxs}
                    xySeries={series}
                    dismiss={dismiss}
                    isPinned={isPinned}
                    seriesIdx={seriesIdx!}
                    replaceVariables={props.replaceVariables}
                    dataLinks={dataLinks}
                  />
                );
              }}
              maxWidth={props.options.tooltip.maxWidth}
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
