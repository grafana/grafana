import { getBackendSrv } from '@grafana/runtime';
import { contextSrv } from 'app/core/core';

import { DatasourceAPIVersions, ScopedResourceClient } from './client';
import { GroupVersionResource } from './types';

jest.mock('@grafana/runtime', () => ({
  getBackendSrv: jest.fn().mockReturnValue({
    get: jest.fn(),
    post: jest.fn(),
  }),
  config: {
    buildInfo: { versionString: 'test-version' },
  },
}));

jest.mock('app/core/services/context_srv');

jest.mock('../../api/utils', () => ({
  getAPINamespace: jest.fn().mockReturnValue('default'),
}));

describe('DatasourceAPIVersions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('get', async () => {
    const getMock = jest.fn().mockResolvedValue({
      groups: [
        { name: 'testdata.datasource.grafana.app', preferredVersion: { version: 'v1' } },
        { name: 'prometheus.datasource.grafana.app', preferredVersion: { version: 'v2' } },
        { name: 'myorg-myplugin.datasource.grafana.app', preferredVersion: { version: 'v3' } },
      ],
    });
    getBackendSrv().get = getMock;
    const apiVersions = new DatasourceAPIVersions();
    expect(await apiVersions.get('testdata')).toBe('v1');
    expect(await apiVersions.get('grafana-testdata-datasource')).toBe('v1');
    expect(await apiVersions.get('prometheus')).toBe('v2');
    expect(await apiVersions.get('graphite')).toBeUndefined();
    expect(await apiVersions.get('myorg-myplugin-datasource')).toBe('v3');
    expect(getMock).toHaveBeenCalledTimes(1);
    expect(getMock).toHaveBeenCalledWith('/apis');
  });
});

describe('ScopedResourceClient', () => {
  let client: ScopedResourceClient;
  let postMock: jest.Mock;
  const gvr: GroupVersionResource = { group: 'test.grafana.app', version: 'v1', resource: 'testresources' };

  beforeEach(() => {
    jest.clearAllMocks();
    postMock = jest.fn().mockResolvedValue({ metadata: { name: 'created-resource' } });
    (getBackendSrv as jest.Mock).mockReturnValue({
      post: postMock,
    });
    client = new ScopedResourceClient(gvr);
  });

  describe('create', () => {
    it('should generate name prefix from user login with alphabetic characters', async () => {
      contextSrv.user.login = 'john.doe123';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'jo',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should handle login with special characters and numbers', async () => {
      contextSrv.user.login = 'user@example.com';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'us',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should handle login starting with numbers', async () => {
      contextSrv.user.login = '123admin456';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'ad',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should handle login with only one alphabetic character', async () => {
      contextSrv.user.login = '123a456';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'a',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should handle login with no alphabetic characters', async () => {
      contextSrv.user.login = '12345@#$%';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'g',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should fall back to "g" when no login exists', async () => {
      // @ts-expect-error - we want to test the fallback behavior
      contextSrv.user.login = null;

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'g',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should fall back to "g" when login is undefined', async () => {
      // @ts-expect-error - we want to test the fallback behavior
      contextSrv.user.login = undefined;

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'g',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should fall back to "g" when login is empty string', async () => {
      contextSrv.user.login = '';

      const obj = { metadata: {}, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'g',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });

    it('should not set generateName when metadata.name is already provided', async () => {
      contextSrv.user.login = 'testuser';

      const obj = { metadata: { name: 'existing-name' }, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            name: 'existing-name',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
      expect(postMock.mock.calls[0][1].metadata).not.toHaveProperty('generateName');
    });

    it('should not set generateName when metadata.generateName is already provided', async () => {
      contextSrv.user.login = 'testuser';

      const obj = { metadata: { generateName: 'existing-prefix' }, spec: {} };
      await client.create(obj);

      expect(postMock).toHaveBeenCalledWith(
        '/apis/test.grafana.app/v1/namespaces/default/testresources',
        {
          metadata: {
            generateName: 'existing-prefix',
            annotations: { 'grafana.app/saved-from-ui': 'test-version' },
          },
          spec: {},
        },
        { params: undefined }
      );
    });
  });
});
