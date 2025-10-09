import { PanelOptionsEditorBuilder } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Options as CandlestickOptions } from '@grafana/schema/src/raw/composable/candlestick/panelcfg/x/CandlestickPanelCfg_types.gen';
import { Options as HeatmapOptions } from '@grafana/schema/src/raw/composable/heatmap/panelcfg/x/HeatmapPanelCfg_types.gen';
import { Options as StatetimelineOptions } from '@grafana/schema/src/raw/composable/statetimeline/panelcfg/x/StateTimelinePanelCfg_types.gen';
import { Options as StatusHistoryOptions } from '@grafana/schema/src/raw/composable/statushistory/panelcfg/x/StatusHistoryPanelCfg_types.gen';
import { Options as TimeseriesOptions } from '@grafana/schema/src/raw/composable/timeseries/panelcfg/x/TimeSeriesPanelCfg_types.gen';

/**
 * Adds common text control options to a visualization options
 * @param builder
 * @public
 */
export function addAnnotationOptions<
  T extends HeatmapOptions | TimeseriesOptions | StatusHistoryOptions | StatetimelineOptions | CandlestickOptions,
>(builder: PanelOptionsEditorBuilder<T>) {
  const category = [t('grafana-ui.builder.annotations', 'Annotations')];

  builder.addBooleanSwitch({
    path: 'annotations.multiLane',
    category,
    name: t('grafana-ui.builder.annotations.multi-lane-name', 'Enable multi-lane annotations'),
    description: t(
      'grafana-ui.builder.annotations.multi-lane-desc',
      'Breaks each annotation frame into a separate row in the visualization'
    ),
    defaultValue: false,
  });

  builder.addBooleanSwitch({
    path: 'annotations.showLine',
    category,
    name: t('grafana-ui.builder.annotations.show-line-marker', 'Enable annotation indicator line'),
    description: t(
      'grafana-ui.builder.annotations.desc.show-line-marker',
      'Toggles the vertical annotation indicator line in the visualization'
    ),
    defaultValue: true,
  });

  builder.addBooleanSwitch({
    path: 'annotations.showRegions',
    category,
    name: t('grafana-ui.builder.annotations.show-regions', 'Enable region overlay'),
    description: t(
      'grafana-ui.builder.annotations.desc.show-regions',
      'Toggles the region overlay in the visualization'
    ),
    defaultValue: true,
  });

  builder.addSliderInput({
    path: 'annotations.regionOpacity',
    category,
    name: t('grafana-ui.builder.annotations.region-opacity', 'Region opacity'),
    description: t('grafana-ui.builder.annotations.desc.region-opacity', 'Sets the annotation region opacity'),
    showIf: (currentOptions) => currentOptions.annotations?.showRegions,
    defaultValue: 10,
    settings: {
      min: 1,
      max: 100,
      step: 2,
    },
  });
}
