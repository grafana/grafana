/**
 * To generate alerting k8s APIs, run:
 * `npx rtk-query-codegen-openapi ./scripts/generate-alerting-rtk-apis.ts`
 */

import { ConfigFile } from '@rtk-query/codegen-openapi';
import { accessSync } from 'fs';

const schemaFile = '../data/alerting/openapi.json';

try {
  // Check we have the OpenAPI before generating alerting RTK APIs,
  // as this is currently a manual process
  accessSync(schemaFile);
} catch (e) {
  console.error('\nCould not find OpenAPI definition.\n');
  console.error(
    'Please visit /openapi/v3/apis/notifications.alerting.grafana.app/v0alpha1 and save the OpenAPI definition to data/alerting/openapi.json\n'
  );
  throw e;
}

const config: ConfigFile = {
  schemaFile,
  apiFile: '',
  tag: true,
  outputFiles: {
    '../public/app/features/alerting/unified/openapi/timeIntervalsApi.gen.ts': {
      apiFile: '../public/app/features/alerting/unified/api/alertingApi.ts',
      apiImport: 'alertingApi',
      filterEndpoints: [
        'listNamespacedTimeInterval',
        'createNamespacedTimeInterval',
        'deleteNamespacedTimeInterval',
        'replaceNamespacedTimeInterval',
      ],
      exportName: 'generatedTimeIntervalsApi',
      flattenArg: false,
    },
    '../public/app/features/alerting/unified/openapi/receiversApi.gen.ts': {
      apiFile: '../public/app/features/alerting/unified/api/alertingApi.ts',
      apiImport: 'alertingApi',
      filterEndpoints: [
        'listNamespacedReceiver',
        'createNamespacedReceiver',
        'readNamespacedReceiver',
        'deleteNamespacedReceiver',
        'replaceNamespacedReceiver',
      ],
      exportName: 'generatedReceiversApi',
      flattenArg: false,
    },
    '../public/app/features/alerting/unified/openapi/templatesApi.gen.ts': {
      apiFile: '../public/app/features/alerting/unified/api/alertingApi.ts',
      apiImport: 'alertingApi',
      filterEndpoints: [
        'listNamespacedTemplateGroup',
        'createNamespacedTemplateGroup',
        'readNamespacedTemplateGroup',
        'replaceNamespacedTemplateGroup',
        'deleteNamespacedTemplateGroup',
      ],
      exportName: 'generatedTemplatesApi',
    },
    '../public/app/features/alerting/unified/openapi/routesApi.gen.ts': {
      apiFile: '../public/app/features/alerting/unified/api/alertingApi.ts',
      apiImport: 'alertingApi',
      filterEndpoints: [
        'listNamespacedRoutingTree',
        'replaceNamespacedRoutingTree',
        'deleteCollectionNamespacedRoutingTree',
      ],
      exportName: 'generatedRoutesApi',
      flattenArg: false,
    },
  },
};

export default config;
