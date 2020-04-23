import { TestData } from '../pages/testdata';
import { Panel } from '../pages/panel';
import { EditPanel } from '../pages/editPanel';
import { Graph } from '../pages/graph';
import { componentFactory } from '../support';

export const Components = {
  DataSource: {
    TestData,
  },
  Panels: {
    Panel,
    EditPanel,
    Visualization: {
      Graph,
    },
  },
  BackButton: componentFactory({
    selectors: {
      backArrow: 'Go Back button',
    },
  }),
};
