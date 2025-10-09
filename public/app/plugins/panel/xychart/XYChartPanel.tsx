import { css } from '@emotion/css';
import { useMemo } from 'react';

import { colorManipulator, FALLBACK_COLOR, PanelProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import {
  AdHocFilterItem,
  TooltipDisplayMode,
  TooltipPlugin2,
  UPlotChart,
  VizLayout,
  VizLegend,
  VizLegendItem,
  useStyles2,
  useTheme2,
  usePanelContext,
} from '@grafana/ui';
import {
  AdHocFilterModel,
  FILTER_FOR_OPERATOR,
  getDisplayValuesForCalcs,
  TooltipHoverMode,
} from '@grafana/ui/internal';

import { getDataLinks } from '../status-history/utils';

import { XYChartTooltip } from './XYChartTooltip';
import { Options } from './panelcfg.gen';
import { prepConfig } from './scatter';
import { prepSeries } from './utils';

type Props2 = PanelProps<Options>;

export const XYChartPanel2 = (props: Props2) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const { canExecuteActions, onAddAdHocFilter } = usePanelContext();
  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);

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
              getAdHocFilters={(seriesIdx, dataIdx) => {
                if (seriesIdx === 0 || !series[seriesIdx - 1]) {
                  return [];
                }

                const xySeries = series[seriesIdx - 1];
                const xField = xySeries.x.field;

                // Check if the field supports filtering
                // We only show filters on filterable fields (xField.config.filterable).
                // Fields will have been marked as filterable by the data source if that data source supports adhoc filtering
                // (eg. Prom or Loki) and the field types support adhoc filtering (eg. string or number - depending on the data source).
                // Fields may later be marked as not filterable. For example, fields created from Grafana Transforms that
                // are derived from a data source, but are not present in the data source.
                // We choose `xField` here because it contains the label-value pair, rather than `yField` which is the numeric Value.
                if (
                  config.featureToggles.adhocFiltersInTooltips &&
                  xField.config.filterable &&
                  onAddAdHocFilter != null
                ) {
                  const adHocFilterItem: AdHocFilterItem = {
                    key: xField.name,
                    operator: FILTER_FOR_OPERATOR,
                    value: String(xField.values[dataIdx]),
                  };

                  const adHocFilters: AdHocFilterModel[] = [
                    {
                      ...adHocFilterItem,
                      onClick: () => onAddAdHocFilter(adHocFilterItem),
                    },
                  ];

                  return adHocFilters;
                }

                return [];
              }}
              render={(u, dataIdxs, seriesIdx, isPinned, dismiss, timeRange2, viaSync, dataLinks, adHocFilters) => {
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
                    adHocFilters={adHocFilters}
                    canExecuteActions={userCanExecuteActions}
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
