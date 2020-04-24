import { selectors } from '@grafana/e2e-selectors';

import { VisualizationTab } from './visualizationTab';
import { pageFactory } from '../../support';

export const Graph = {
  VisualizationTab,
  Legend: pageFactory({
    url: '',
    selectors: selectors.components.Panels.Visualization.Graph.Legend,
  }),
};
