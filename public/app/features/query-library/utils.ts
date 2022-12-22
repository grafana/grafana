import { DataQuery } from '@grafana/data/src';

export const defaultQuery: DataQuery = {
  refId: 'A',
  datasource: {
    type: 'datasource',
    uid: 'grafana',
  },
  queryType: 'measurements',
};

export const implementationComingSoonAlert = () => {
  alert('Implementation coming soon!');
};
