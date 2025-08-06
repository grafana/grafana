export const rootFolder = {
  kind: 'Folder',
  apiVersion: 'folder.grafana.app/v1beta1',
  metadata: {
    name: 'general',
    uid: 'DvhY6m059FraHn96xsOKsb8GRtHy2ftVDUPkqZTzP4kX',
    resourceVersion: '-62135596800000',
    creationTimestamp: undefined,
    annotations: {
      'grafana.app/updatedTimestamp': '0001-01-01T00:00:00Z',
    },
  },
  spec: {
    title: 'Dashboards',
    description: '',
  },
  status: {},
};

export const sharedWithMeFolder = {
  kind: 'Folder',
  apiVersion: 'folder.grafana.app/v1beta1',
  metadata: {
    name: 'sharedwithme',
    uid: 'DlDSzXw31VwXu6LHMw0JMoFvfVtYzyf3NEPzsOXHtxQX',
    resourceVersion: '-62135596800000',
    creationTimestamp: undefined,
    annotations: {
      'grafana.app/updatedTimestamp': '0001-01-01T00:00:00Z',
    },
  },
  spec: {
    title: 'Shared with me',
    description: 'Dashboards and folders shared with me',
  },
  status: {},
};
