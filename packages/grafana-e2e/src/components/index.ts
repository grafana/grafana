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
  PanelEditor: {
    General: componentFactory({
      selectors: selectors.components.PanelEditor.General,
    }),
    OptionsPane: componentFactory({
      selectors: selectors.components.PanelEditor.OptionsPane,
    }),
    // not sure about the naming *DataPane*
    DataPane: componentFactory({
      selectors: selectors.components.PanelEditor.DataPane,
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
    selectors: selectors.components.QueryTab,
  }),
  AlertTab: componentFactory({
    selectors: selectors.components.AlertTab,
  }),
  TransformTab: componentFactory({
    selectors: selectors.components.TransformTab,
  }),
  QueryEditorToolbarItem: componentFactory({
    selectors: selectors.components.QueryEditorToolbarItem,
  }),
  BackButton: componentFactory({
    selectors: selectors.components.BackButton,
  }),
  OptionsGroup: componentFactory({
    selectors: selectors.components.OptionsGroup,
  }),
  PluginVisualization: componentFactory({
    selectors: selectors.components.PluginVisualization,
  }),
  Select: componentFactory({
    selectors: selectors.components.Select,
  }),
  FieldConfigEditor: componentFactory({
    selectors: selectors.components.FieldConfigEditor,
  }),
  OverridesConfigEditor: componentFactory({
    selectors: selectors.components.OverridesConfigEditor,
  }),
};
