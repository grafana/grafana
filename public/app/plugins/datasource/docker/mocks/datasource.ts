import { type DataSourcePluginOptionsEditorProps } from '@grafana/data';

import { type DockerOptions } from '../types';

export function createDefaultDockerOptions() {
  return {
    id: 1,
    uid: 'test-uid',
    orgId: 1,
    name: 'docker',
    type: 'docker',
    access: 'proxy',
    readOnly: false,
    withCredentials: false,
    basicAuth: false,
    url: 'http://localhost:2375',
    jsonData: {},
    secureJsonFields: {},
  };
}

export function createConfigEditorProps(
  overrides: Partial<DataSourcePluginOptionsEditorProps<DockerOptions>> = {}
): DataSourcePluginOptionsEditorProps<DockerOptions> {
  return {
    options: createDefaultDockerOptions() as DataSourcePluginOptionsEditorProps<DockerOptions>['options'],
    onOptionsChange: jest.fn(),
    ...overrides,
  };
}
