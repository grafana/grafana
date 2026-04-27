import { ActionType, DataTopic, HttpRequestMethod } from '@grafana/data';
import { type DataFrame, FieldType } from '@grafana/data/dataframe';

/**
 * Due to the integration with mocked uplot, it's important that we test with times that are between 1759388895560 and 1759390250000
 */

const minTime = 1759388895560;
const maxTime = 1759390250000;
const clusterThresholdMs = 108356;
export const mockAnnotationFrame: DataFrame = {
  length: 4,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
  fields: [
    {
      name: 'time',
      config: {},
      type: FieldType.time,
      values: [1759388895560, 1759388995560, 1759389995560, 1759390200000],
    },
    {
      name: 'title',
      config: {},
      type: FieldType.string,
      values: ['HG Launch (ops) 1', 'HG Launch (ops) 2', 'HG Launch (ops) 3', 'HG Launch (ops) 4'],
    },
    {
      name: 'text',
      config: {},
      type: FieldType.string,
      values: [
        'Launching HG Instance ops with hgrun version 1',
        'Launching HG Instance ops with hgrun version 2',
        'Launching HG Instance ops with hgrun version 3',
        'Launching HG Instance ops with hgrun version 4',
      ],
    },
    {
      name: 'tags',
      config: {},
      type: FieldType.other,
      values: [['tag1', 'tag2'], ['tag2', 'tag3'], [], []],
    },
    {
      name: 'source',
      config: {},
      type: FieldType.other,
      values: [
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        null,
      ],
    },
    {
      name: 'color',
      config: {},
      type: FieldType.string,
      values: ['#8F3BB8', '#8F3BB8', '#8F3BB8', '#8F3BB8'],
    },
    {
      name: 'type',
      config: {},
      type: FieldType.string,
      values: ['HG Launch 1', 'HG Launch 2', 'HG Launch 3', 'HG Launch 4'],
    },
    {
      name: 'isRegion',
      config: {},
      type: FieldType.boolean,
      values: [false, false, false, false],
    },
    {
      name: 'avatarUrl',
      config: {},
      type: FieldType.string,
      values: [
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
      ],
    },
  ],
};
export const mockIRMAnnotation: DataFrame = {
  length: 3,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
  fields: [
    {
      name: 'type',
      config: {},
      type: FieldType.string,
      values: ['Show `squad:loki` Incidents', 'Show `squad:loki` Incidents', 'Show `squad:loki` Incidents'],
    },
    {
      name: 'color',
      config: {},
      type: FieldType.string,
      values: ['#F00', '#F0F', '#00F'],
    },
    {
      name: 'time',
      config: {},
      type: FieldType.time,
      values: [1759388895560, 1759388995560, 1759389995560],
    },
    {
      name: 'title',
      config: {},
      type: FieldType.string,
      values: [
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4655'><b>prod-000-writes-error</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4665'><b>LogsDeleteRequestProcessingStuck (dev-us-west-0, notify)</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4683'><b>Vendor BYOC cell Failed to get annotations</b></a>",
      ],
    },
    {
      name: 'text',
      config: {},
      type: FieldType.string,
      values: [
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>A very large label value payload (>16MB) triggered a panic in the code. We disabled the gateway as a temporary mitigation.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/4edf116c0e3ee9af875ea934d417c899?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2021-10-04%2F2555752049286_b9cf6475b53000b437ea_192.jpg'>Batman</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p></p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/07f61391eab846fb5c7fbc035dbb3091?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2025-09-01%2F9442928521986_e04cf65c19859e880ef1_192.jpg'>Ada</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>The vendor BYOC cell experienced annotation retrieval failures due to a DNS misconfiguration where the hostname was resolving to the wrong regional endpoint, causing 530 status code errors on alert state history queries. The team identified the root cause as a recent DNS name format change and merged a fix, which was rolled out to resolve the issue.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png'>Theo</div>",
      ],
    },
    {
      name: 'tags',
      config: {},
      type: FieldType.other,
      values: [
        ['squad:adaptive-telemetry', 'squad:loki', 'team_name:loki'],
        ['squad:loki'],
        [
          'service:dashboard-service',
          'service:datasources',
          'squad:alerting',
          'squad:databases-sre',
          'squad:insights',
          'squad:loki',
        ],
      ],
    },
    {
      name: 'id',
      config: {},
      type: FieldType.number,
      // @todo we probably want a better way of defining this, but I've added test coverage and we can come back to this later
      // id of 0 means the annotation is not editable or deletable
      values: [0, 4665, 4683],
    },
    {
      name: 'dashboardUID',
      config: {},
      type: FieldType.string,
      values: ['abc-123', 'def-456', 'jkl-789'],
    },
    {
      name: 'source',
      config: {},
      type: FieldType.other,
      values: [
        {
          enable: true,
          hide: false,
          iconColor: 'yellow',
          name: 'Show `squad:loki` Incidents',
          mappings: {
            id: {
              source: 'field',
              value: 'Incident ID',
            },
            tags: {
              source: 'field',
              value: 'Labels',
            },
            text: {
              source: 'field',
              value: 'Incident Description',
            },
            time: {
              source: 'field',
              value: 'Incident started',
            },
            timeEnd: {
              source: 'field',
              value: 'Incident ended',
            },
            title: {
              source: 'field',
              value: 'Incident Title',
            },
          },
          target: {
            queryString: "label:'squad:loki'",
            queryType: 'incidents',
            refId: 'Anno',
          },
          datasource: {
            uid: 'a12a4bc8-78ce-4d25-b28b-2fd6b1a88691',
            type: 'grafana-incident-datasource',
          },
        },
        null,
        null,
      ],
    },
    {
      name: 'isRegion',
      config: {},
      type: FieldType.boolean,
      values: [false, false, false],
    },
  ],
};
export const mockIRMAnnotationRegion: DataFrame = {
  length: 3,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
  fields: [
    {
      name: 'type',
      config: {},
      type: FieldType.string,
      values: ['Show `squad:loki` Incidents', 'Show `squad:loki` Incidents', 'Show `squad:loki` Incidents'],
    },
    {
      name: 'color',
      config: {},
      type: FieldType.string,
      values: ['#F00', '#F0F', '#00F'],
    },
    {
      name: 'time',
      config: {},
      type: FieldType.time,
      values: [1759388895560, 1759388995560, 1759389995560],
    },
    {
      name: 'timeEnd',
      config: {},
      type: FieldType.number,
      values: [1759389095560, 1759389195560, 1759390195560],
    },
    {
      name: 'title',
      config: {},
      type: FieldType.string,
      values: [
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4655'><b>prod-000-writes-error</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4665'><b>LogsDeleteRequestProcessingStuck (dev-us-west-0, notify)</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4683'><b>Vendor BYOC cell Failed to get annotations</b></a>",
      ],
    },
    {
      name: 'text',
      config: {},
      type: FieldType.string,
      values: [
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>A very large label value payload (>16MB) triggered a panic in the code. We disabled the gateway as a temporary mitigation.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/4edf116c0e3ee9af875ea934d417c899?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2021-10-04%2F2555752049286_b9cf6475b53000b437ea_192.jpg'>Batman</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p></p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/07f61391eab846fb5c7fbc035dbb3091?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2025-09-01%2F9442928521986_e04cf65c19859e880ef1_192.jpg'>Ada</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>The vendor BYOC cell experienced annotation retrieval failures due to a DNS misconfiguration where the hostname was resolving to the wrong regional endpoint, causing 530 status code errors on alert state history queries. The team identified the root cause as a recent DNS name format change and merged a fix, which was rolled out to resolve the issue.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png'>Theo</div>",
      ],
    },
    {
      name: 'tags',
      config: {},
      type: FieldType.other,
      values: [
        ['squad:adaptive-telemetry', 'squad:loki', 'team_name:loki'],
        ['squad:loki'],
        [
          'service:dashboard-service',
          'service:datasources',
          'squad:alerting',
          'squad:databases-sre',
          'squad:insights',
          'squad:loki',
        ],
      ],
    },
    {
      name: 'id',
      config: {},
      type: FieldType.number,
      // @todo we probably want a better way of defining this, but I've added test coverage and we can come back to this later
      // id of 0 means the annotation is not editable or deletable
      values: [0, 4665, 4683],
    },
    {
      name: 'dashboardUID',
      config: {},
      type: FieldType.string,
      values: ['abc-123', 'def-456', 'jkl-789'],
    },
    {
      name: 'source',
      config: {},
      type: FieldType.other,
      values: [
        {
          enable: true,
          hide: false,
          iconColor: 'yellow',
          name: 'Show `squad:loki` Incidents',
          mappings: {
            id: {
              source: 'field',
              value: 'Incident ID',
            },
            tags: {
              source: 'field',
              value: 'Labels',
            },
            text: {
              source: 'field',
              value: 'Incident Description',
            },
            time: {
              source: 'field',
              value: 'Incident started',
            },
            timeEnd: {
              source: 'field',
              value: 'Incident ended',
            },
            title: {
              source: 'field',
              value: 'Incident Title',
            },
          },
          target: {
            queryString: "label:'squad:loki'",
            queryType: 'incidents',
            refId: 'Anno',
          },
          datasource: {
            uid: 'a12a4bc8-78ce-4d25-b28b-2fd6b1a88691',
            type: 'grafana-incident-datasource',
          },
        },
        null,
        null,
      ],
    },
    {
      name: 'isRegion',
      config: {},
      type: FieldType.boolean,
      values: [true, true, true],
    },
  ],
};

export const mockIRMClusteringAnnotation: DataFrame = {
  length: 4,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
  fields: [
    {
      name: 'type',
      config: {},
      type: FieldType.string,
      values: [
        'Show `squad:loki` Incidents',
        'Show `squad:loki` Incidents',
        'Show `squad:loki` Incidents',
        'Show `squad:loki` Incidents',
      ],
    },
    {
      name: 'color',
      config: {},
      type: FieldType.string,
      values: ['#F00', '#F0F', '#00F', '#DDD'],
    },
    {
      name: 'time',
      config: {},
      type: FieldType.time,
      values: [1759388895560, 1759388896560, 1759388995560, 1759389995560],
    },
    {
      name: 'title',
      config: {},
      type: FieldType.string,
      values: [
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4655'><b>prod-000-writes-error</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4656'><b>prod-001-writes-error</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4667'><b>LogsDeleteRequestProcessingStuck (dev-us-west-0, notify)</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4683'><b>Vendor BYOC cell Failed to get annotations</b></a>",
      ],
    },
    {
      name: 'text',
      config: {},
      type: FieldType.string,
      values: [
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>A very large label value payload (>16MB) triggered a panic in the code. We disabled the gateway as a temporary mitigation.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/4edf116c0e3ee9af875ea934d417c899?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2021-10-04%2F2555752049286_b9cf6475b53000b437ea_192.jpg'>Batman</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>A very large label value payload (>32MB) triggered a panic in the code. We disabled the gateway as a temporary mitigation.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/4edf116c0e3ee9af875ea934d417c899?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2021-10-04%2F2555752049286_b9cf6475b53000b437ea_192.jpg'>Alfred</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p></p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/07f61391eab846fb5c7fbc035dbb3091?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2025-09-01%2F9442928521986_e04cf65c19859e880ef1_192.jpg'>Ada</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>The vendor BYOC cell experienced annotation retrieval failures due to a DNS misconfiguration where the hostname was resolving to the wrong regional endpoint, causing 530 status code errors on alert state history queries. The team identified the root cause as a recent DNS name format change and merged a fix, which was rolled out to resolve the issue.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png'>Theo</div>",
      ],
    },
    {
      name: 'tags',
      config: {},
      type: FieldType.other,
      values: [
        ['squad:adaptive-telemetry', 'squad:loki', 'team_name:loki'],
        ['squad:adaptive-telemetry', 'squad:loki', 'team_name:loki'],
        ['squad:loki'],
        [
          'service:dashboard-service',
          'service:datasources',
          'squad:alerting',
          'squad:databases-sre',
          'squad:insights',
          'squad:loki',
        ],
      ],
    },
    {
      name: 'id',
      config: {},
      type: FieldType.number,
      values: [4655, 4656, 4665, 4683],
    },
    {
      name: 'dashboardUID',
      config: {},
      type: FieldType.string,
      values: ['abc-123', 'def-456', 'jkl-789', 'ccc-ddd'],
    },
    {
      name: 'source',
      config: {},
      type: FieldType.other,
      values: [
        {
          enable: true,
          hide: false,
          iconColor: 'yellow',
          name: 'Show `squad:loki` Incidents',
          mappings: {
            id: {
              source: 'field',
              value: 'Incident ID',
            },
            tags: {
              source: 'field',
              value: 'Labels',
            },
            text: {
              source: 'field',
              value: 'Incident Description',
            },
            time: {
              source: 'field',
              value: 'Incident started',
            },
            timeEnd: {
              source: 'field',
              value: 'Incident ended',
            },
            title: {
              source: 'field',
              value: 'Incident Title',
            },
          },
          target: {
            queryString: "label:'squad:loki'",
            queryType: 'incidents',
            refId: 'Anno',
          },
          datasource: {
            uid: 'a12a4bc8-78ce-4d25-b28b-2fd6b1a88691',
            type: 'grafana-incident-datasource',
          },
        },
        null,
        null,
        null,
      ],
    },
    {
      name: 'isRegion',
      config: {},
      type: FieldType.boolean,
      values: [false, false, false, false],
    },
  ],
};
export const mockClusterRegions: DataFrame = {
  length: 6,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
  fields: [
    {
      name: 'type',
      config: {},
      type: FieldType.string,
      values: [
        'Show `squad:loki` Incidents',
        'Show `squad:loki` Incidents',
        'Show `squad:loki` Incidents',
        'Show `squad:loki` Incidents',
        'Show `squad:loki` Incidents',
        'Show `squad:loki` Incidents',
      ],
    },
    {
      name: 'color',
      config: {},
      type: FieldType.string,
      values: ['#F00', '#F0F', '#00F', '#DDD', '#DDD', '#DDD'],
    },
    {
      name: 'time',
      config: {},
      type: FieldType.time,

      // [ x ________________ x ]
      // [ x _|____________|_ x ]
      // [ x _|___|____|___|_ x ]
      values: [
        // point at the start
        minTime,
        minTime + 200,
        minTime + 200 + clusterThresholdMs,
        maxTime - 1000,
        maxTime - 200,
        maxTime,
      ],
    },
    {
      name: 'timeEnd',
      config: {},
      type: FieldType.time,
      values: [
        // not a region
        null,
        // spans the entire width - 200 from each side
        maxTime - 200,
        // is entirely contained by previous region, but more than the cluster threshold from either start/stop
        maxTime - 200 - clusterThresholdMs,
        // spans the entire width - 2000 from each side
        maxTime - 2000,
        // super tiny anno
        maxTime - 199,
        // not a region
        null,
      ],
    },
    {
      name: 'isRegion',
      config: {},
      type: FieldType.boolean,
      values: [false, true, true, true, true, false],
    },
    {
      name: 'title',
      config: {},
      type: FieldType.string,
      values: [
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4655'><b>prod-000-writes-error</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4656'><b>prod-001-writes-error</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4667'><b>LogsDeleteRequestProcessingStuck (dev-us-west-0, notify)</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4683'><b>Vendor BYOC cell Failed to get annotations</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4683'><b>Vendor BYOC cell Failed to get annotations</b></a>",
        "<a data-testid='mock-annotation-title' target='_blank' href='/a/grafana-irm-app/incidents/4683'><b>Vendor BYOC cell Failed to get annotations</b></a>",
      ],
    },
    {
      name: 'text',
      config: {},
      type: FieldType.string,
      values: [
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>A very large label value payload (>16MB) triggered a panic in the code. We disabled the gateway as a temporary mitigation.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/4edf116c0e3ee9af875ea934d417c899?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2021-10-04%2F2555752049286_b9cf6475b53000b437ea_192.jpg'>Batman</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>A very large label value payload (>32MB) triggered a panic in the code. We disabled the gateway as a temporary mitigation.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/4edf116c0e3ee9af875ea934d417c899?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2021-10-04%2F2555752049286_b9cf6475b53000b437ea_192.jpg'>Alfred</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p></p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/07f61391eab846fb5c7fbc035dbb3091?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2025-09-01%2F9442928521986_e04cf65c19859e880ef1_192.jpg'>Ada</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>The vendor BYOC cell experienced annotation retrieval failures due to a DNS misconfiguration where the hostname was resolving to the wrong regional endpoint, causing 530 status code errors on alert state history queries. The team identified the root cause as a recent DNS name format change and merged a fix, which was rolled out to resolve the issue.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png'>Theo</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>The vendor BYOC cell experienced annotation retrieval failures due to a DNS misconfiguration where the hostname was resolving to the wrong regional endpoint, causing 530 status code errors on alert state history queries. The team identified the root cause as a recent DNS name format change and merged a fix, which was rolled out to resolve the issue.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png'>Theo</div>",
        "<div data-testid='mock-annotation-text' style='max-width: 230px;'><p>The vendor BYOC cell experienced annotation retrieval failures due to a DNS misconfiguration where the hostname was resolving to the wrong regional endpoint, causing 530 status code errors on alert state history queries. The team identified the root cause as a recent DNS name format change and merged a fix, which was rolled out to resolve the issue.</p> Declared by <img height='100%' width='14' style='border-radius: 6px; margin-right:4px;' src='https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png'>Theo</div>",
      ],
    },
    {
      name: 'tags',
      config: {},
      type: FieldType.other,
      values: [
        ['squad:adaptive-telemetry', 'squad:loki', 'team_name:loki'],
        ['squad:adaptive-telemetry', 'squad:loki', 'team_name:loki'],
        ['squad:loki'],
        [
          'service:dashboard-service',
          'service:datasources',
          'squad:alerting',
          'squad:databases-sre',
          'squad:insights',
          'squad:loki',
        ],
        [],
        [],
      ],
    },
    {
      name: 'id',
      config: {},
      type: FieldType.number,
      values: [4655, 4656, 4665, 4683, null, null],
    },
    {
      name: 'source',
      config: {},
      type: FieldType.other,
      values: [
        {
          enable: true,
          hide: false,
          iconColor: 'yellow',
          name: 'Show `squad:loki` Incidents',
          mappings: {
            id: {
              source: 'field',
              value: 'Incident ID',
            },
            tags: {
              source: 'field',
              value: 'Labels',
            },
            text: {
              source: 'field',
              value: 'Incident Description',
            },
            time: {
              source: 'field',
              value: 'Incident started',
            },
            timeEnd: {
              source: 'field',
              value: 'Incident ended',
            },
            title: {
              source: 'field',
              value: 'Incident Title',
            },
          },
          target: {
            queryString: "label:'squad:loki'",
            queryType: 'incidents',
            refId: 'Anno',
          },
          datasource: {
            uid: 'a12a4bc8-78ce-4d25-b28b-2fd6b1a88691',
            type: 'grafana-incident-datasource',
          },
        },
        null,
        null,
        null,
        null,
        null,
      ],
    },
  ],
};

export const mockAnnotationRegionFrame: DataFrame = {
  length: 4,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
  fields: [
    {
      name: 'time',
      config: {},
      type: FieldType.time,
      values: [1759388895560, 1759388995560, 1759389995560, 1759390200000],
    },
    {
      name: 'timeEnd',
      config: {},
      type: FieldType.number,
      values: [1759388895560 + 50000, 1759388995560 + 50000, 1759389995560 + 50000, 1759390200000 + 50000],
    },
    {
      name: 'title',
      config: {},
      type: FieldType.string,
      values: ['HG Launch (ops) 1', 'HG Launch (ops) 2', 'HG Launch (ops) 3', 'HG Launch (ops) 4'],
    },
    {
      name: 'text',
      config: {},
      type: FieldType.string,
      values: [
        'Launching HG Instance ops with hgrun version 1',
        'Launching HG Instance ops with hgrun version 2',
        'Launching HG Instance ops with hgrun version 3',
        'Launching HG Instance ops with hgrun version 4',
      ],
    },
    {
      name: 'tags',
      config: {},
      type: FieldType.other,
      values: [['tag1', 'tag2'], ['tag2', 'tag3'], [], []],
    },
    {
      name: 'source',
      config: {},
      type: FieldType.other,
      values: [
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        {
          datasource: {
            type: 'loki',
            uid: '000000193',
          },
          enable: true,
          expr: '{cluster="$cluster", namespace="hosted-grafana", slug="$slug"} |= `msg="launching hosted grafana"` | logfmt  ',
          iconColor: 'dark-purple',
          instant: false,
          name: 'HG Launch',
          tagKeys: 'hg-launch',
          textFormat: 'Launching HG Instance {{slug}} with hgrun {{version}}',
          titleFormat: 'HG Launch ({{slug}})',
        },
        null,
      ],
    },
    {
      name: 'color',
      config: {},
      type: FieldType.string,
      values: ['#8F3BB8', '#8F3BB8', '#8F3BB8', '#8F3BB8'],
    },
    {
      name: 'type',
      config: {},
      type: FieldType.string,
      values: ['HG Launch 1', 'HG Launch 2', 'HG Launch 3', 'HG Launch 4'],
    },
    {
      name: 'isRegion',
      config: {},
      type: FieldType.boolean,
      values: [true, true, true, true],
    },
    {
      name: 'avatarUrl',
      config: {},
      type: FieldType.string,
      values: [
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
      ],
    },
  ],
};

export const mockAlertingFrame: DataFrame = {
  length: 11,
  meta: {
    dataTopic: DataTopic.Annotations,
  },
  fields: [
    {
      name: 'time',
      config: {},
      type: FieldType.time,
      values: [
        1759388895560, 1759388995560, 1759389995560, 1759390200000, 1759390210000, 1759390220000, 1759390230000,
        1759390240000, 1759390242000, 1759390244000, 1759390247000,
      ],
    },
    {
      name: 'title',
      config: {},
      type: FieldType.string,
      values: [
        'Title 1',
        'Title 2',
        'Title 3',
        'Title 4',
        'Title 5',
        'Title 6',
        'Title 7',
        'Title 8',
        'Title 9',
        'Title 10',
        'Title 11',
      ],
    },
    {
      name: 'text',
      //@ts-ignore
      getLinks: jest.fn(() => [
        {
          title: 'Link 1',
          href: 'http://example.com/1',
          target: '_blank',
          origin: {},
        },
        {
          title: 'Link 2',
          href: 'http://example.com/2',
          target: '_blank',
          origin: {},
        },
      ]),
      state: {
        scopedVars: {},
      },
      config: {
        links: [
          { title: 'Link 1', url: 'http://example.com/1' },
          { title: 'Link 2', url: 'http://example.com/2' },
        ],
        actions: [
          {
            type: ActionType.Fetch,
            title: 'Action 1',
            [ActionType.Fetch]: { method: HttpRequestMethod.GET, url: 'http://example.com/1' },
          },
          {
            type: ActionType.Fetch,
            title: 'Action 2',
            [ActionType.Fetch]: { method: HttpRequestMethod.POST, url: 'http://example.com/2' },
          },
        ],
      },
      type: FieldType.string,
      values: [
        'Launching HG Instance ops with hgrun version 1',
        'Launching HG Instance ops with hgrun version 2',
        'Launching HG Instance ops with hgrun version 3',
        'Launching HG Instance ops with hgrun version 4',
        'Launching HG Instance ops with hgrun version 5',
        'Launching HG Instance ops with hgrun version 6',
        'Launching HG Instance ops with hgrun version 7',
        'Launching HG Instance ops with hgrun version 8',
        'Launching HG Instance ops with hgrun version 9',
        'Launching HG Instance ops with hgrun version 10',
        'Launching HG Instance ops with hgrun version 11',
      ],
    },
    {
      name: 'tags',
      config: {},
      type: FieldType.other,
      values: [['tag1', 'tag2'], ['tag2', 'tag3'], [], [], [], [], [], [], [], [], []],
    },
    {
      name: 'source',
      config: {},
      type: FieldType.other,
      values: [null, null, null, null, null, null, null, null, null, null, null],
    },
    {
      name: 'color',
      config: {},
      type: FieldType.string,
      values: [
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
        '#8F3BB8',
      ],
    },
    {
      name: 'type',
      config: {},
      type: FieldType.string,
      values: [
        'HG Launch 1',
        'HG Launch 2',
        'HG Launch 3',
        'HG Launch 4',
        'HG Launch 5',
        'HG Launch 6',
        'HG Launch 7',
        'HG Launch 8',
        'HG Launch 9',
        'HG Launch 10',
        'HG Launch 11',
      ],
    },
    {
      name: 'isRegion',
      config: {},
      type: FieldType.boolean,
      values: [false, false, false, false, false, false, false, false, false, false, false],
    },
    {
      name: 'avatarUrl',
      config: {},
      type: FieldType.string,
      values: [
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
        'https://www.gravatar.com/avatar/592723e91b4f16fa4241f6818e601000?s=512&d=https%3A%2F%2Favatars.slack-edge.com%2F2024-07-01%2F7363759362996_d8a231a9ad749aac0a19_192.png',
      ],
    },
    {
      name: 'newState',
      config: {},
      type: FieldType.string,
      values: [
        'alerting',
        'ok',
        'normal',
        'pending',
        'no_data',
        'nodata',
        'paused',
        'recovering',
        'firing',
        'inactive',
        'error',
      ],
    },
    {
      name: 'alertId',
      config: {},
      type: FieldType.string,
      values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'],
    },
    {
      name: 'data',
      config: {},
      type: FieldType.other,
      values: [{ error: 'Alerting error test!' }, null, null, null, null, null, null, null, null, null, null],
    },
  ],
};

export const allAnnotations = [mockAnnotationFrame, mockIRMAnnotation];
export const allAnnotationRegions = [mockAnnotationRegionFrame, mockIRMAnnotationRegion];
