import { selectors } from '@grafana/e2e-selectors';

import { pageFactory } from '../../support';

export const VisualizationTab = pageFactory({
  url: '',
  selectors: selectors.components.Panels.Visualization.Graph.VisualizationTab,
});
