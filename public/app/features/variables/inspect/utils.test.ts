import {
  getAffectedPanelIdsForVariable,
  getAllAffectedPanelIdsForVariableChange,
  getDependenciesForVariable,
  getPropsWithVariable,
} from './utils';
import { PanelModel } from '@grafana/data';
import { variableAdapters } from '../adapters';
import { createDataSourceVariableAdapter } from '../datasource/adapter';
import { createCustomVariableAdapter } from '../custom/adapter';
import { createQueryVariableAdapter } from '../query/adapter';

describe('getPropsWithVariable', () => {
  it('when called it should return the correct graph', () => {
    const result = getPropsWithVariable(
      '$unknownVariable',
      {
        key: 'model',
        value: {
          templating: {
            list: [
              {
                current: {
                  selected: false,
                  text: 'No data sources found',
                  value: '',
                },
                hide: 0,
                includeAll: false,
                label: null,
                multi: false,
                name: 'dependsOnUnknown',
                options: [],
                query: 'prometheus',
                refresh: 1,
                regex: '/.*$unknownVariable.*/',
                skipUrlSync: false,
                type: 'datasource',
              },
            ],
          },
        },
      },
      {}
    );

    expect(result).toEqual({
      templating: {
        list: {
          dependsOnUnknown: {
            regex: '/.*$unknownVariable.*/',
          },
        },
      },
    });
  });

  it('when called with a valid an id that is not part of valid names it should return the correct graph', () => {
    const value = {
      targets: [
        {
          id: 'A',
          description: '$tag_host-[[tag_host]]',
          query:
            'SELECT mean(total) AS "total" FROM "disk" WHERE "host" =~ /$host$/ AND $timeFilter GROUP BY time($interval), "host", "path"',
          alias: '$tag_host [[tag_host]] $col $host',
        },
      ],
    };

    const result = getPropsWithVariable(
      'host',
      {
        key: 'model',
        value,
      },
      {}
    );

    expect(result).toEqual({
      targets: {
        A: {
          alias: '$tag_host [[tag_host]] $col $host',
          query:
            'SELECT mean(total) AS "total" FROM "disk" WHERE "host" =~ /$host$/ AND $timeFilter GROUP BY time($interval), "host", "path"',
        },
      },
    });
  });

  it('when called with an id that is part of valid alias names it should return the correct graph', () => {
    const value = {
      targets: [
        {
          id: 'A',
          description: '[[tag_host1]]',
          description2: '$tag_host1',
          query:
            'SELECT mean(total) AS "total" FROM "disk" WHERE "host" =~ /$host$/ AND $timeFilter GROUP BY time($interval), "host", "path"',
          alias: '[[tag_host1]] $tag_host1 $col $host',
        },
      ],
    };

    const tagHostResult = getPropsWithVariable(
      'tag_host1',
      {
        key: 'model',
        value,
      },
      {}
    );

    expect(tagHostResult).toEqual({
      targets: {
        A: {
          description: '[[tag_host1]]',
          description2: '$tag_host1',
        },
      },
    });
  });

  it('when called with an id that is part of valid query names it should return the correct graph', () => {
    const value = {
      targets: [
        {
          id: 'A',
          description: '[[timeFilter]]',
          description2: '$timeFilter',
          query:
            'SELECT mean(total) AS "total" FROM "disk" WHERE "host" =~ /$host$/ AND $timeFilter GROUP BY time($interval), "host", "path"',
          alias: '[[timeFilter]] $timeFilter $col $host',
        },
      ],
    };

    const tagHostResult = getPropsWithVariable(
      'timeFilter',
      {
        key: 'model',
        value,
      },
      {}
    );

    expect(tagHostResult).toEqual({
      targets: {
        A: {
          description: '[[timeFilter]]',
          description2: '$timeFilter',
          alias: '[[timeFilter]] $timeFilter $col $host',
        },
      },
    });
  });

  it('when using a real world example with rows and repeats', () => {
    const result = getPropsWithVariable(
      'query0',
      {
        key: 'model',
        value: dashWithRepeatsAndRows,
      },
      {}
    );

    expect(result).toEqual({
      panels: {
        'Panel with var in title $query0[15]': {
          title: 'Panel with var in title $query0',
        },
        'Panel with var in target[16]': {
          targets: {
            '0': {
              alias: '$query0',
            },
          },
        },
        'Panel with var repeat[17]': {
          repeat: 'query0',
        },
        'Panel with var in title $query0[11]': {
          title: 'Panel with var in title $query0',
        },
        'Panel with var in target[12]': {
          targets: {
            '0': {
              alias: '$query0',
            },
          },
        },
        'Panel with var repeat[13]': {
          repeat: 'query0',
        },
        'Row with var[2]': {
          repeat: 'query0',
        },
        'Panel with var in title $query0[5]': {
          title: 'Panel with var in title $query0',
        },
        'Panel with var in target[7]': {
          targets: {
            '0': {
              alias: '$query0',
            },
          },
        },
        'Panel with var repeat[6]': {
          repeat: 'query0',
        },
      },
    });
  });
});

describe('getAffectedPanelIdsForVariable', () => {
  describe('when called with a real world example with rows and repeats', () => {
    it('then it should return correct panel ids', () => {
      const panels = dashWithRepeatsAndRows.panels.map(
        (panel: PanelModel) =>
          (({
            id: panel.id,
            getSaveModel: () => panel,
          } as unknown) as PanelModel)
      );
      const result = getAffectedPanelIdsForVariable('query0', panels);
      expect(result).toEqual([15, 16, 17, 11, 12, 13, 2, 5, 7, 6]);
    });
  });
});

variableAdapters.setInit(() => [
  createDataSourceVariableAdapter(),
  createCustomVariableAdapter(),
  createQueryVariableAdapter(),
]);

describe('getDependenciesForVariable', () => {
  describe('when called with a real world example with dependencies', () => {
    it('then it should return correct dependencies', () => {
      const {
        templating: { list: variables },
      } = dashWithTemplateDependenciesAndPanels;
      const result = getDependenciesForVariable('ds_instance', variables, new Set());
      expect([...result]).toEqual([
        'ds',
        'query_with_ds',
        'depends_on_query_with_ds',
        'depends_on_query_with_ds_regex',
        'depends_on_all',
      ]);
    });
  });
});

describe('getAllAffectedPanelIdsForVariableChange ', () => {
  describe('when called with a real world example with dependencies and panels', () => {
    it('then it should return correct panelIds', () => {
      const {
        panels: panelsAsJson,
        templating: { list: variables },
      } = dashWithTemplateDependenciesAndPanels;
      const panels = panelsAsJson.map(
        (panel: PanelModel) =>
          (({
            id: panel.id,
            getSaveModel: () => panel,
          } as unknown) as PanelModel)
      );
      const result = getAllAffectedPanelIdsForVariableChange('ds_instance', variables, panels);
      expect(result).toEqual([2, 3, 4, 5]);
    });
  });

  describe('when called with a real world example with dependencies and panels on a leaf variable', () => {
    it('then it should return correct panelIds', () => {
      const {
        panels: panelsAsJson,
        templating: { list: variables },
      } = dashWithTemplateDependenciesAndPanels;
      const panels = panelsAsJson.map(
        (panel: PanelModel) =>
          (({
            id: panel.id,
            getSaveModel: () => panel,
          } as unknown) as PanelModel)
      );
      const result = getAllAffectedPanelIdsForVariableChange('depends_on_all', variables, panels);
      expect(result).toEqual([2]);
    });
  });

  describe('when called with a real world example with $__all_variables in links', () => {
    it('then it should return correct panelIds', () => {
      const {
        panels: panelsAsJson,
        templating: { list: variables },
      } = dashWithAllVariables;
      const panels = panelsAsJson.map(
        (panel: PanelModel) =>
          (({
            id: panel.id,
            getSaveModel: () => panel,
          } as unknown) as PanelModel)
      );
      const result = getAllAffectedPanelIdsForVariableChange('unknown', variables, panels);
      expect(result).toEqual([2, 3]);
    });
  });
});

const dashWithRepeatsAndRows: any = {
  annotations: {
    list: [
      {
        builtIn: 1,
        datasource: '-- Grafana --',
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotations & Alerts',
        target: {
          limit: 100,
          matchAny: false,
          tags: [],
          type: 'dashboard',
        },
        type: 'dashboard',
      },
    ],
  },
  editable: true,
  gnetId: null,
  graphTooltip: 0,
  id: 518,
  iteration: 1631794309996,
  links: [],
  liveNow: false,
  panels: [
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 0,
        y: 0,
      },
      id: 14,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel without vars',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 5,
        y: 0,
      },
      id: 15,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var in title $query0',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 10,
        y: 0,
      },
      id: 16,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          alias: '$query0',
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var in target',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 24,
        x: 0,
        y: 3,
      },
      id: 17,
      maxPerRow: 2,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      repeat: 'query0',
      repeatDirection: 'v',
      targets: [
        {
          alias: '',
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var repeat',
      type: 'stat',
    },
    {
      collapsed: false,
      datasource: null,
      gridPos: {
        h: 1,
        w: 24,
        x: 0,
        y: 6,
      },
      id: 9,
      panels: [],
      title: 'Row without var',
      type: 'row',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 0,
        y: 7,
      },
      id: 4,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel without vars',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 5,
        y: 7,
      },
      id: 11,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var in title $query0',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 10,
        y: 7,
      },
      id: 12,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          alias: '$query0',
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var in target',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 24,
        x: 0,
        y: 10,
      },
      id: 13,
      maxPerRow: 2,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      repeat: 'query0',
      repeatDirection: 'v',
      targets: [
        {
          alias: '',
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var repeat',
      type: 'stat',
    },
    {
      collapsed: false,
      datasource: null,
      gridPos: {
        h: 1,
        w: 24,
        x: 0,
        y: 13,
      },
      id: 2,
      panels: [],
      repeat: 'query0',
      title: 'Row with var',
      type: 'row',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 0,
        y: 14,
      },
      id: 10,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel without vars',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 5,
        y: 14,
      },
      id: 5,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var in title $query0',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 5,
        x: 10,
        y: 14,
      },
      id: 7,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      targets: [
        {
          alias: '$query0',
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var in target',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 3,
        w: 24,
        x: 0,
        y: 17,
      },
      id: 6,
      maxPerRow: 2,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        text: {},
        textMode: 'auto',
        tooltip: {
          mode: 'single',
        },
      },
      pluginVersion: '8.2.0-pre',
      repeat: 'query0',
      repeatDirection: 'v',
      targets: [
        {
          alias: '',
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Panel with var repeat',
      type: 'stat',
    },
  ],
  schemaVersion: 31,
  style: 'dark',
  tags: [],
  templating: {
    list: [
      {
        allValue: null,
        current: {
          selected: true,
          text: ['A'],
          value: ['A'],
        },
        datasource: 'gdev-testdata',
        definition: '*',
        description: null,
        error: null,
        hide: 0,
        includeAll: true,
        label: null,
        multi: true,
        name: 'query0',
        options: [],
        query: {
          query: '*',
          refId: 'StandardVariableQuery',
        },
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        type: 'query',
      },
    ],
  },
  time: {
    from: 'now-6h',
    to: 'now',
  },
  timepicker: {},
  timezone: '',
  title: 'Variables update POC',
  uid: 'tISItwInz',
  version: 2,
};

const dashWithTemplateDependenciesAndPanels: any = {
  annotations: {
    list: [
      {
        builtIn: 1,
        datasource: '-- Grafana --',
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotations & Alerts',
        target: {
          limit: 100,
          matchAny: false,
          tags: [],
          type: 'dashboard',
        },
        type: 'dashboard',
      },
    ],
  },
  editable: true,
  gnetId: null,
  graphTooltip: 0,
  id: 522,
  iteration: 1632133230646,
  links: [],
  liveNow: false,
  panels: [
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          custom: {
            axisLabel: '',
            axisPlacement: 'auto',
            barAlignment: 0,
            drawStyle: 'line',
            fillOpacity: 0,
            gradientMode: 'none',
            hideFrom: {
              legend: false,
              tooltip: false,
              viz: false,
            },
            lineInterpolation: 'linear',
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: 'linear',
            },
            showPoints: 'auto',
            spanNulls: false,
            stacking: {
              group: 'A',
              mode: 'none',
            },
            thresholdsStyle: {
              mode: 'off',
            },
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 6,
        w: 4,
        x: 0,
        y: 0,
      },
      id: 2,
      options: {
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        tooltip: {
          mode: 'single',
        },
      },
      title: 'Depends on all $depends_on_all [2]',
      type: 'timeseries',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          custom: {
            axisLabel: '',
            axisPlacement: 'auto',
            barAlignment: 0,
            drawStyle: 'line',
            fillOpacity: 0,
            gradientMode: 'none',
            hideFrom: {
              legend: false,
              tooltip: false,
              viz: false,
            },
            lineInterpolation: 'linear',
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: 'linear',
            },
            showPoints: 'auto',
            spanNulls: false,
            stacking: {
              group: 'A',
              mode: 'none',
            },
            thresholdsStyle: {
              mode: 'off',
            },
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 6,
        w: 4,
        x: 4,
        y: 0,
      },
      id: 3,
      options: {
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        tooltip: {
          mode: 'single',
        },
      },
      title: 'Depends on regex $depends_on_query_with_ds_regex [3]',
      type: 'timeseries',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          custom: {
            axisLabel: '',
            axisPlacement: 'auto',
            barAlignment: 0,
            drawStyle: 'line',
            fillOpacity: 0,
            gradientMode: 'none',
            hideFrom: {
              legend: false,
              tooltip: false,
              viz: false,
            },
            lineInterpolation: 'linear',
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: 'linear',
            },
            showPoints: 'auto',
            spanNulls: false,
            stacking: {
              group: 'A',
              mode: 'none',
            },
            thresholdsStyle: {
              mode: 'off',
            },
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 6,
        w: 4,
        x: 8,
        y: 0,
      },
      id: 4,
      options: {
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        tooltip: {
          mode: 'single',
        },
      },
      title: 'Depends on query $depends_on_query_with_ds [4]',
      type: 'timeseries',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'palette-classic',
          },
          custom: {
            axisLabel: '',
            axisPlacement: 'auto',
            barAlignment: 0,
            drawStyle: 'line',
            fillOpacity: 0,
            gradientMode: 'none',
            hideFrom: {
              legend: false,
              tooltip: false,
              viz: false,
            },
            lineInterpolation: 'linear',
            lineWidth: 1,
            pointSize: 5,
            scaleDistribution: {
              type: 'linear',
            },
            showPoints: 'auto',
            spanNulls: false,
            stacking: {
              group: 'A',
              mode: 'none',
            },
            thresholdsStyle: {
              mode: 'off',
            },
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 6,
        w: 4,
        x: 12,
        y: 0,
      },
      id: 5,
      options: {
        legend: {
          calcs: [],
          displayMode: 'list',
          placement: 'bottom',
        },
        tooltip: {
          mode: 'single',
        },
      },
      title: 'Depends on ds $query_with_ds [5]',
      type: 'timeseries',
    },
  ],
  schemaVersion: 31,
  style: 'dark',
  tags: [],
  templating: {
    list: [
      {
        current: {
          selected: false,
          text: 'TestData DB',
          value: 'TestData DB',
        },
        description: null,
        error: null,
        hide: 0,
        includeAll: false,
        label: null,
        multi: false,
        name: 'ds',
        options: [],
        query: 'testdata',
        queryValue: '',
        refresh: 1,
        regex: '/$ds_instance/',
        skipUrlSync: false,
        type: 'datasource',
      },
      {
        allValue: null,
        current: {
          selected: true,
          text: ['A'],
          value: ['A'],
        },
        datasource: {
          uid: '${ds}',
        },
        definition: '*',
        description: null,
        error: null,
        hide: 0,
        includeAll: true,
        label: null,
        multi: true,
        name: 'query_with_ds',
        options: [],
        query: {
          query: '*',
          refId: 'StandardVariableQuery',
        },
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        type: 'query',
      },
      {
        allValue: null,
        current: {
          selected: true,
          text: ['AA'],
          value: ['AA'],
        },
        datasource: null,
        definition: '$query_with_ds.*',
        description: null,
        error: null,
        hide: 0,
        includeAll: true,
        label: null,
        multi: true,
        name: 'depends_on_query_with_ds',
        options: [],
        query: {
          query: '$query_with_ds.*',
          refId: 'StandardVariableQuery',
        },
        refresh: 1,
        regex: '',
        skipUrlSync: false,
        sort: 0,
        type: 'query',
      },
      {
        allValue: null,
        current: {
          selected: false,
          text: 'A',
          value: 'A',
        },
        datasource: null,
        definition: '*',
        description: null,
        error: null,
        hide: 0,
        includeAll: false,
        label: null,
        multi: false,
        name: 'depends_on_query_with_ds_regex',
        options: [],
        query: {
          query: '*',
          refId: 'StandardVariableQuery',
        },
        refresh: 1,
        regex: '/.*$query_with_ds.*/',
        skipUrlSync: false,
        sort: 0,
        type: 'query',
      },
      {
        allValue: null,
        current: {
          selected: false,
          text: 'AB',
          value: 'AB',
        },
        datasource: {
          uid: '${ds}',
        },
        definition: '$query_with_ds.*',
        description: null,
        error: null,
        hide: 0,
        includeAll: false,
        label: null,
        multi: false,
        name: 'depends_on_all',
        options: [],
        query: {
          query: '$query_with_ds.*',
          refId: 'StandardVariableQuery',
        },
        refresh: 1,
        regex: '/.*$depends_on_query_with_ds_regex.*/',
        skipUrlSync: false,
        sort: 0,
        type: 'query',
      },
      {
        allValue: null,
        current: {
          selected: true,
          text: 'TestData DB',
          value: 'TestData DB',
        },
        description: null,
        error: null,
        hide: 0,
        includeAll: false,
        label: null,
        multi: false,
        name: 'ds_instance',
        options: [
          {
            selected: true,
            text: 'TestData DB',
            value: 'TestData DB',
          },
          {
            selected: false,
            text: 'gdev-testdata',
            value: 'gdev-testdata',
          },
        ],
        query: 'TestData DB, gdev-testdata',
        queryValue: '',
        skipUrlSync: false,
        type: 'custom',
      },
    ],
  },
  time: {
    from: 'now-6h',
    to: 'now',
  },
  timepicker: {},
  timezone: '',
  title: 'Variables dependencies update POC',
  uid: 'n60iRMNnk',
  version: 6,
};

const dashWithAllVariables: any = {
  annotations: {
    list: [
      {
        builtIn: 1,
        datasource: '-- Grafana --',
        enable: true,
        hide: true,
        iconColor: 'rgba(0, 211, 255, 1)',
        name: 'Annotations & Alerts',
        target: {
          limit: 100,
          matchAny: false,
          tags: [],
          type: 'dashboard',
        },
        type: 'dashboard',
      },
    ],
  },
  editable: true,
  fiscalYearStartMonth: 0,
  gnetId: null,
  graphTooltip: 0,
  id: 603,
  iteration: 1635254953926,
  links: [],
  liveNow: false,
  panels: [
    {
      datasource: null,
      description: '',
      fieldConfig: {
        defaults: {
          color: {
            mode: 'thresholds',
          },
          links: [
            {
              targetBlank: true,
              title: 'Depends on Data Link',
              url: 'http://www.grafana.com?${__all_variables}',
            },
          ],
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 0,
        y: 0,
      },
      id: 2,
      links: [],
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        textMode: 'auto',
      },
      pluginVersion: '8.3.0-pre',
      title: 'Depends on Data Link',
      type: 'stat',
    },
    {
      datasource: null,
      description: '',
      fieldConfig: {
        defaults: {
          color: {
            mode: 'thresholds',
          },
          links: [],
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 9,
        w: 12,
        x: 12,
        y: 0,
      },
      id: 3,
      links: [
        {
          targetBlank: true,
          title: 'Panel Link',
          url: 'http://www.grafana.com?${__all_variables}',
        },
      ],
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        textMode: 'auto',
      },
      pluginVersion: '8.3.0-pre',
      title: 'Depends on Panel Link',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'thresholds',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 8,
        w: 12,
        x: 0,
        y: 9,
      },
      id: 5,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        textMode: 'auto',
      },
      pluginVersion: '8.3.0-pre',
      title: 'Depends on none',
      type: 'stat',
    },
    {
      datasource: null,
      fieldConfig: {
        defaults: {
          color: {
            mode: 'thresholds',
          },
          mappings: [],
          thresholds: {
            mode: 'absolute',
            steps: [
              {
                color: 'green',
                value: null,
              },
              {
                color: 'red',
                value: 80,
              },
            ],
          },
        },
        overrides: [],
      },
      gridPos: {
        h: 8,
        w: 12,
        x: 12,
        y: 9,
      },
      id: 6,
      options: {
        colorMode: 'value',
        graphMode: 'area',
        justifyMode: 'auto',
        orientation: 'auto',
        reduceOptions: {
          calcs: ['lastNotNull'],
          fields: '',
          values: false,
        },
        textMode: 'auto',
      },
      pluginVersion: '8.3.0-pre',
      targets: [
        {
          alias: '',
          datasource: 'gdev-testdata',
          refId: 'A',
          scenarioId: 'random_walk',
        },
      ],
      title: 'Depends on var $custom',
      type: 'stat',
    },
  ],
  revision: null,
  schemaVersion: 31,
  style: 'dark',
  tags: [],
  templating: {
    list: [
      {
        allValue: null,
        current: {
          selected: true,
          text: ['1'],
          value: ['1'],
        },
        description: null,
        error: null,
        hide: 0,
        includeAll: true,
        label: null,
        multi: true,
        name: 'custom',
        options: [
          {
            selected: false,
            text: 'All',
            value: '$__all',
          },
          {
            selected: true,
            text: '1',
            value: '1',
          },
          {
            selected: false,
            text: '2',
            value: '2',
          },
          {
            selected: false,
            text: '3',
            value: '3',
          },
        ],
        query: '1,2,3',
        queryValue: '',
        skipUrlSync: false,
        type: 'custom',
      },
    ],
  },
  time: {
    from: 'now-6h',
    to: 'now',
  },
  timepicker: {},
  timezone: '',
  title: 'Depends on Links',
  uid: 'XkBHMzF7z',
  version: 6,
  weekStart: '',
};
