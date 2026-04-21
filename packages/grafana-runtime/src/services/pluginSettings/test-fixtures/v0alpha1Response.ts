import { type Settings } from '../types';

export const myOrgTestAppSettings: Settings = structuredClone({
  kind: 'Settings',
  apiVersion: 'myorg-test-app.grafana.app/v0alpha1',
  metadata: {
    name: 'myorg-test-app',
    namespace: 'default',
  },
  spec: {
    enabled: true,
    pinned: false,
    jsonData: {
      apiUrl: 'http://api-url.com',
    },
  },
  secure: {
    apiKey: {
      name: 'lps-sv-48fe6a860af4f72f3eefd0032e207ea1f942fcc88693411993ff778462867d27',
    },
    password: {
      name: 'lps-sv-58d8e08c33cf0bd6d7545df6d7957333f5604371ff87ca294e4572e6d9bedb04',
    },
  },
});
