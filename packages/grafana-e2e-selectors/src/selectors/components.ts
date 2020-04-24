import { selectorFactory } from '../types';
import { Pages } from './pages';

export const Components = {
  DataSource: {
    TestData: {
      QueryTab: selectorFactory({
        scenarioSelect: 'Test Data Query scenario select',
        max: 'TestData max',
        min: 'TestData min',
        noise: 'TestData noise',
        seriesCount: 'TestData series count',
        spread: 'TestData spread',
        startValue: 'TestData start value',
      }),
    },
  },
  Panels: {
    Panel: selectorFactory({
      title: (title: string) => `Panel header title item ${title}`,
      headerItems: (item: string) => `Panel header item ${item}`,
    }),
    Visualization: {
      Graph: {
        VisualizationTab: selectorFactory({
          legendSection: 'Legend section',
        }),
        Legend: selectorFactory({
          legendItemAlias: (name: string) => `gpl alias ${name}`,
          showLegendSwitch: 'gpl show legend',
        }),
      },
    },
  },
  Drawer: {
    General: selectorFactory({
      title: (title: string) => `Drawer title ${title}`,
      expand: 'Drawer expand',
      contract: 'Drawer contract',
      close: 'Drawer close',
      rcContentWrapper: () => '.drawer-content-wrapper',
    }),
  },
  PanelEditor: {
    General: selectorFactory({
      content: 'Panel editor content',
    }),
    OptionsPane: selectorFactory({
      content: 'Panel editor option pane content',
      close: Pages.Dashboard.Toolbar.toolbarItems('Close options pane'),
      open: Pages.Dashboard.Toolbar.toolbarItems('Open options pane'),
      select: 'Panel editor option pane select',
    }),
    // not sure about the naming *DataPane*
    DataPane: selectorFactory({
      content: 'Panel editor data pane content',
    }),
  },
  PanelInspector: {
    Data: selectorFactory({
      content: 'Panel inspector Data content',
    }),
    Stats: selectorFactory({
      content: 'Panel inspector Stats content',
    }),
    Json: selectorFactory({
      content: 'Panel inspector Json content',
    }),
    Query: selectorFactory({
      content: 'Panel inspector Query content',
    }),
  },
  Tab: selectorFactory({
    title: (title: string) => `Tab ${title}`,
    active: () => '[class*="-activeTabStyle"]',
  }),
  QueryTab: selectorFactory({
    content: 'Query editor tab content',
  }),
  AlertTab: selectorFactory({
    content: 'Alert editor tab content',
  }),
  TransformTab: selectorFactory({
    content: 'Transform editor tab content',
  }),
  QueryEditorToolbarItem: selectorFactory({
    button: (title: string) => `QueryEditor toolbar item button ${title}`,
  }),
  BackButton: selectorFactory({
    backArrow: 'Go Back button',
  }),
  OptionsGroup: selectorFactory({
    toggle: (title: string) => `Options group ${title}`,
  }),
  PluginVisualization: selectorFactory({
    item: (title: string) => `Plugin visualization item ${title}`,
    current: () => '[class*="-currentVisualizationItem"]',
  }),
  Select: selectorFactory({
    option: 'Select option',
  }),
  FieldConfigEditor: selectorFactory({
    content: 'Field config editor content',
  }),
  OverridesConfigEditor: selectorFactory({
    content: 'Field overrides editor content',
  }),
};
