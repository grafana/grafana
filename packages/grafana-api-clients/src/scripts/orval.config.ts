import type { Config } from '@orval/core';
import { defineConfig } from 'orval';
import path from 'path';

const basePath = path.resolve(__dirname, '../../../..');

const createAPIConfig = (app: string, version: string): Config => {
  const filePath = `../clients/fetch/${app}/${version}/client.gen.ts`;

  return {
    [filePath]: {
      input: { target: path.join(basePath, `packages/grafana-openapi/src/apis/${app}.grafana.app-${version}.json`) },
      output: {
        target: filePath,
        client: 'fetch' as const,
        mode: 'split' as const,
        baseUrl: '',
        fileExtension: '.gen.ts',
        override: {
          namingConvention: { enum: 'PascalCase' },
          mutator: {
            path: `../clients/fetch/${app}/${version}/baseApi.ts`,
            name: 'customFetch',
          },
        },
      },
    },
  };
};

export default defineConfig({
  ...createAPIConfig('advisor', 'v0alpha1'),
  ...createAPIConfig('correlations', 'v0alpha1'),
  ...createAPIConfig('dashboard', 'v0alpha1'),
  ...createAPIConfig('dashboard', 'v1beta1'),
  ...createAPIConfig('dashboard', 'v2beta1'),
  ...createAPIConfig('folder', 'v1beta1'),
  ...createAPIConfig('iam', 'v0alpha1'),
  ...createAPIConfig('playlist', 'v1'),
  ...createAPIConfig('collections', 'v1alpha1'),
  ...createAPIConfig('preferences', 'v1alpha1'),
  ...createAPIConfig('provisioning', 'v0alpha1'),
  ...createAPIConfig('shorturl', 'v1beta1'),
  ...createAPIConfig('notifications.alerting', 'v0alpha1'),
  ...createAPIConfig('rules.alerting', 'v0alpha1'),
  ...createAPIConfig('historian.alerting', 'v0alpha1'),
  ...createAPIConfig('logsdrilldown', 'v1beta1'),
  ...createAPIConfig('logsdrilldown', 'v1alpha1'),
  ...createAPIConfig('quotas', 'v0alpha1'),
  // PLOP_INJECT_FETCH_API_CLIENT - Used by the API client generator
});
