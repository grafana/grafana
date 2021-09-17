import { getAffectedPanelIdsForVariable, getPropsWithVariable } from './utils';

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
      const result = getAffectedPanelIdsForVariable('query0', dashWithRepeatsAndRows);
      expect(result).toEqual([15, 16, 17, 11, 12, 13, 2, 5, 7, 6]);
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
