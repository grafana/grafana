/**
 * To generate alerting k8s APIs, run:
 * `npx rtk-query-codegen-openapi ./scripts/generate-alerting-rtk-apis.ts`
 */

import { ConfigFile } from '@rtk-query/codegen-openapi';
import fs from 'fs';

const schemaFile = '../data/alerting/openapi.json';

try {
  // Check we have the OpenAPI before generating alerting RTK APIs,
  // as this is currently a manual process
  fs.existsSync(schemaFile);
} catch (e) {
  console.error(e);
  console.error('Could not find OpenAPI definition.');
  console.error(
    'Please visit /openapi/v3/apis/notifications.alerting.grafana.app/v0alpha1 and save the OpenAPI definition to data/alerting/openapi.json'
  );
  process.exit(1);
}

const config: ConfigFile = {
  schemaFile,
  apiFile: '',
  tag: true,
  outputFiles: {
    '../public/app/features/alerting/unified/openapi/timeIntervalsApi.gen.ts': {
      apiFile: '../public/app/features/alerting/unified/api/alertingApi.ts',
      apiImport: 'alertingApi',
      filterEndpoints: [/TimeInterval/],
      exportName: 'generatedTimeIntervalsApi',
      flattenArg: false,
    },
  },
};

export default config;
