import { getFrameMatchers, MapLayerHandler, MapLayerOptions, PanelData } from '@grafana/data/src';

export const applyLayerFilter = (
  handler: MapLayerHandler<unknown>,
  options: MapLayerOptions<unknown>,
  panelDataProps: PanelData
): void => {
  if (handler.update) {
    let panelData = panelDataProps;
    if (options.filterData) {
      const matcherFunc = getFrameMatchers(options.filterData);
      panelData = {
        ...panelData,
        series: panelData.series.filter(matcherFunc),
      };
    }
    handler.update(panelData);
  }
};
