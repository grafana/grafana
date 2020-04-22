import { VisualizationTab } from './visualizationTab';
import { pageFactory } from '../../support';

export const Graph = {
  VisualizationTab,
  Legend: pageFactory({
    url: '',
    selectors: {
      legendItemAlias: (name: string) => `gpl alias ${name}`,
      showLegendSwitch: 'gpl show legend',
    },
  }),
};
