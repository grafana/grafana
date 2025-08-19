export const getTestQueryList = () => ({
  kind: 'QueryTemplateList',
  apiVersion: 'querylibrary.grafana.app/v0alpha1',
  metadata: {
    resourceVersion: '1783293408052252672',
    remainingItemCount: 0,
  },
  items: [
    {
      kind: 'QueryTemplate',
      apiVersion: 'querylibrary.grafana.app/v0alpha1',
      metadata: {
        name: 'AElastic2nkf9',
        generateName: 'AElastic',
        namespace: 'default',
        uid: '65327fce-c545-489d-ada5-16f909453d12',
        resourceVersion: '1783293341664808960',
        creationTimestamp: '2024-04-25T20:32:58Z',
        annotations: { 'grafana.app/createdBy': 'user:u000000001' },
      },
      spec: {
        title: 'Elastic Query Template',
        targets: [
          {
            variables: {},
            properties: {
              refId: 'A',
              datasource: {
                type: 'elasticsearch',
                uid: 'elastic-uid',
              },
              alias: '',
              metrics: [
                {
                  id: '1',
                  type: 'count',
                },
              ],
              bucketAggs: [
                {
                  field: '@timestamp',
                  id: '2',
                  settings: {
                    interval: 'auto',
                  },
                  type: 'date_histogram',
                },
              ],
              timeField: '@timestamp',
              query: 'test:test ',
            },
          },
        ],
      },
    },
    {
      kind: 'QueryTemplate',
      apiVersion: 'querylibrary.grafana.app/v0alpha1',
      metadata: {
        name: 'ALoki296ta',
        generateName: 'ALoki',
        namespace: 'default',
        uid: '3e71de65-efa7-40e3-8f23-124212cca455',
        resourceVersion: '1783214217151647744',
        creationTimestamp: '2024-04-25T11:05:55Z',
        annotations: { 'grafana.app/createdBy': 'user:u000000001' },
      },
      spec: {
        title: 'Loki Query Template',
        vars: [
          {
            key: '__value',
            defaultValues: [''],
            valueListDefinition: {
              customValues: '',
            },
          },
        ],
        targets: [
          {
            variables: {
              __value: [
                {
                  path: '$.datasource.jsonData.derivedFields.0.url',
                  position: {
                    start: 0,
                    end: 14,
                  },
                  format: 'raw',
                },
                {
                  path: '$.datasource.jsonData.derivedFields.1.url',
                  position: {
                    start: 0,
                    end: 14,
                  },
                  format: 'raw',
                },
                {
                  path: '$.datasource.jsonData.derivedFields.2.url',
                  position: {
                    start: 0,
                    end: 14,
                  },
                  format: 'raw',
                },
              ],
            },
            properties: {
              refId: 'A',
              datasource: {
                type: 'loki',
                uid: 'loki-uid',
              },
              queryType: 'range',
              editorMode: 'code',
              expr: '{test="test"}',
            },
          },
        ],
      },
    },
    {
      kind: 'QueryTemplate',
      apiVersion: 'querylibrary.grafana.app/v0alpha1',
      metadata: {
        name: 'ALoki296tj',
        generateName: 'ALoki',
        namespace: 'default',
        uid: '3e71de65-efa7-40e3-8f23-124212cca456',
        resourceVersion: '1783214217151647744',
        creationTimestamp: '2024-04-25T11:05:55Z',
        annotations: { 'grafana.app/createdBy': 'user:u000000002' },
      },
      spec: {
        title: 'Loki Query Template Hidden',
        isVisible: false,
        vars: [
          {
            key: '__value',
            defaultValues: [''],
            valueListDefinition: {
              customValues: '',
            },
          },
        ],
        targets: [
          {
            variables: {
              __value: [
                {
                  path: '$.datasource.jsonData.derivedFields.0.url',
                  position: {
                    start: 0,
                    end: 14,
                  },
                  format: 'raw',
                },
                {
                  path: '$.datasource.jsonData.derivedFields.1.url',
                  position: {
                    start: 0,
                    end: 14,
                  },
                  format: 'raw',
                },
                {
                  path: '$.datasource.jsonData.derivedFields.2.url',
                  position: {
                    start: 0,
                    end: 14,
                  },
                  format: 'raw',
                },
              ],
            },
            properties: {
              refId: 'A',
              datasource: {
                type: 'loki',
                uid: 'loki-uid',
              },
              queryType: 'range',
              editorMode: 'code',
              expr: '{test="test"}',
            },
          },
        ],
      },
    },
  ],
});
