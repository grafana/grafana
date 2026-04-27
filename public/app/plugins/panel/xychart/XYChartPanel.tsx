import { css } from '@emotion/css';
import { useMemo } from 'react';

import { colorManipulator } from '@grafana/data/themes';
import { FALLBACK_COLOR, type PanelProps } from '@grafana/data/types';
import { t } from '@grafana/i18n';
import { config, PanelDataErrorView } from '@grafana/runtime';
import {
  TooltipDisplayMode,
  TooltipPlugin2,
  UPlotChart,
  VizLayout,
  VizLegend,
  type VizLegendItem,
  usePanelContext,
} from '@grafana/ui';
import { getDisplayValuesForCalcs, TooltipHoverMode } from '@grafana/ui/internal';
import { useStyles2, useTheme2 } from '@grafana/ui/themes';

import { getDataLinks } from '../status-history/utils';

import { XYChartTooltip } from './XYChartTooltip';
import { type Options } from './panelcfg.gen';
import { prepConfig } from './scatter';
import { prepSeries } from './utils';

type Props2 = PanelProps<Options>;

export const XYChartPanel2 = (props: Props2) => {
  const styles = useStyles2(getStyles);
  const theme = useTheme2();

  const { canExecuteActions } = usePanelContext();
  const userCanExecuteActions = useMemo(() => canExecuteActions?.() ?? false, [canExecuteActions]);

  let { mapping, series: mappedSeries } = props.options;

  // regenerate series schema when mappings or data changes
  let series = useMemo(
    () => prepSeries(mapping, mappedSeries, props.data.series, props.fieldConfig),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapping, mappedSeries, props.data.series, props.fieldConfig]
  );

  // if series changed due to mappings or data structure, re-init config & renderers
  const { data, builder, warn } = useMemo(
    () => {
      const { builder, prepData, warn } = prepConfig(series, config.theme2);
      const data = warn ? undefined : prepData(series);
      return { data, builder, warn };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapping, mappedSeries, props.data.structureRev, props.fieldConfig, props.options.tooltip]
  );

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

  if (warn || !builder || !data) {
    return (
      <PanelDataErrorView
        panelId={props.id}
        fieldConfig={props.fieldConfig}
        data={props.data}
        message={warn ?? t('xychart.errors.unknown', 'Unknown error')}
      />
    );
  }

  return (
    <VizLayout width={props.width} height={props.height} legend={renderLegend()}>
      {(vizWidth: number, vizHeight: number) => (
        <UPlotChart config={builder} data={data} width={vizWidth} height={vizHeight}>
          {props.options.tooltip.mode !== TooltipDisplayMode.None && (
            <TooltipPlugin2
              config={builder}
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
