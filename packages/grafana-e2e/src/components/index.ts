import { TestData } from '../pages/testdata';
import { Panel } from '../pages/panel';
import { Graph } from '../pages/graph';
import { componentFactory } from '../support';
import { selectors } from '@grafana/e2e-selectors';

export const Components = {
  DataSource: {
    TestData,
  },
  Panels: {
    Panel,
    Visualization: {
      Graph,
    },
  },
  Drawer: {
    General: componentFactory({
      selectors: selectors.components.Drawer.General,
    }),
  },
  PanelInspector: {
    Data: componentFactory({
      selectors: selectors.components.PanelInspector.Data,
    }),
    Stats: componentFactory({
      selectors: selectors.components.PanelInspector.Stats,
    }),
    Json: componentFactory({
      selectors: selectors.components.PanelInspector.Json,
    }),
    Query: componentFactory({
      selectors: selectors.components.PanelInspector.Query,
    }),
  },
  Tab: componentFactory({
    selectors: selectors.components.Tab,
  }),
  QueryEditorToolbarItem: componentFactory({
    selectors: selectors.components.QueryEditorToolbarItem,
  }),
  BackButton: componentFactory({
    selectors: selectors.components.BackButton,
  }),
};
