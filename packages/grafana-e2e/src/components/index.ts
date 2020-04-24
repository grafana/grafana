import { TestData } from '../pages/testdata';
import { Panel } from '../pages/panel';
import { Graph } from '../pages/graph';
import { componentFactory } from '../support';
import { Dashboard } from '../pages/dashboard';
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
  PanelEditor: {
    General: componentFactory({
      selectors: {
        content: 'Panel editor content',
      },
    }),
    OptionsPane: componentFactory({
      selectors: {
        content: 'Panel editor option pane content',
        close: Dashboard.selectors.toolbarItems('Close options pane'),
        open: Dashboard.selectors.toolbarItems('Open options pane'),
        select: 'Panel editor option pane select',
      },
    }),
    // not sure about the naming *DataPane*
    DataPane: componentFactory({
      selectors: {
        content: 'Panel editor data pane content',
      },
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
  QueryTab: componentFactory({
    selectors: {
      content: 'Query editor tab content',
    },
  }),
  AlertTab: componentFactory({
    selectors: {
      content: 'Alert editor tab content',
    },
  }),
  TransformTab: componentFactory({
    selectors: {
      content: 'Transform editor tab content',
    },
  }),
  QueryEditorToolbarItem: componentFactory({
    selectors: selectors.components.QueryEditorToolbarItem,
  }),
  BackButton: componentFactory({
    selectors: selectors.components.BackButton,
  }),
  OptionsGroup: componentFactory({
    selectors: {
      toggle: (title: string) => `Options group ${title}`,
    },
  }),
  PluginVisualization: componentFactory({
    selectors: {
      item: (title: string) => `Plugin visualization item ${title}`,
      current: () => '[class*="-currentVisualizationItem"]',
    },
  }),
  Select: componentFactory({
    selectors: {
      option: 'Select option',
    },
  }),
  FieldConfigEditor: componentFactory({
    selectors: {
      content: 'Field config editor content',
    },
  }),
  OverridesConfigEditor: componentFactory({
    selectors: {
      content: 'Field overrides editor content',
    },
  }),
};
