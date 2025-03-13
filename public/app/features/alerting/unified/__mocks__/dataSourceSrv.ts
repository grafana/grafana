const ds1 = {
  id: 1,
  uid: 'c8eceabb-0275-4108-8f03-8f74faf4bf6d',
  type: 'prometheus',
  name: 'gdev-prometheus',
  meta: {
    alerting: true,
    info: {
      logos: {
        small: 'http://example.com/logo.png',
      },
    },
  },
  jsonData: {},
  access: 'proxy',
};

export function getDataSourceSrv() {
  return {
    getList: () => [ds1],
    getInstanceSettings: () => ds1,
  };
}
