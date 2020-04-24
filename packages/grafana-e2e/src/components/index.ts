import { TestData } from '../pages/testdata';
import { Panel } from '../pages/panel';
import { Graph } from '../pages/graph';
import { componentFactory } from '../support';
import { Dashboard } from '../pages/dashboard';

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
      selectors: {
        title: (title: string) => `Drawer title ${title}`,
        expand: 'Drawer expand',
        contract: 'Drawer contract',
        close: 'Drawer close',
        rcContentWrapper: () => '.drawer-content-wrapper',
      },
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
      selectors: {
        content: 'Panel inspector Data content',
      },
    }),
    Stats: componentFactory({
      selectors: {
        content: 'Panel inspector Stats content',
      },
    }),
    Json: componentFactory({
      selectors: {
        content: 'Panel inspector Json content',
      },
    }),
    Query: componentFactory({
      selectors: {
        content: 'Panel inspector Query content',
      },
    }),
  },
  Tab: componentFactory({
    selectors: {
      title: (title: string) => `Tab ${title}`,
      active: () => '[class*="-activeTabStyle"]',
    },
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
    selectors: {
      button: (title: string) => `QueryEditor toolbar item button ${title}`,
    },
  }),
  BackButton: componentFactory({
    selectors: {
      backArrow: 'Go Back button',
    },
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
