import { DEFAULT_SUFFIX } from '../ManageComponentsVersionsModal.constants';

export const versionsStubs = [
  { name: 'v1.0', value: true, label: '1.0', status: 'available', default: false },
  { name: 'v2.0', value: true, label: '2.0', status: 'recommended', default: true },
];

export const initialValuesStubs = {
  operator: { name: 'psmdb', value: 'psmdb', label: 'PSMDB 1' },
  component: { name: 'mongod', value: 'mongod', label: 'PSMDB' },
  psmdbmongod: versionsStubs,
  pxcpxc: versionsStubs,
  pxchaproxy: versionsStubs,
  psmdbmongoddefault: versionsStubs[1],
  pxchaproxydefault: versionsStubs[1],
  pxcpxcdefault: versionsStubs[1],
};

// use to omit default labels form testing
// due to parsing the label to a component to show the recommended option
export const omitDefaultLabels = ['psmdbmongoddefault.label', 'pxchaproxydefault.label', 'pxcpxcdefault.label'];

export const possibleComponentOptionsStubs = {
  psmdb: [{ name: 'mongod', value: 'mongod', label: 'PSMDB' }],
  pxc: [
    { name: 'pxc', value: 'pxc', label: 'PXC' },
    { name: 'haproxy', value: 'haproxy', label: 'HAProxy' },
  ],
};

export const operatorsOptionsStubs = [
  { name: 'psmdb', value: 'psmdb', label: 'PSMDB 1' },
  { name: 'pxc', value: 'pxc', label: 'PXC 1' },
];

export const psmdbComponentOptionsStubs = [{ name: 'mongod', value: 'mongod', label: 'PSMDB' }];

export const versionsFieldNameStub = 'psmdbmongod';

export const defaultFieldNameStub = `${versionsFieldNameStub}${DEFAULT_SUFFIX}`;
