/**
 * To generate query library k8s APIs, run:
 * `npx rtk-query-codegen-openapi ./public/app/features/query-library/api/scripts/generate-rtk-apis.ts` from the root of the repo
 */

import { ConfigFile } from '@rtk-query/codegen-openapi';
import { accessSync } from 'fs';

const schemaFile = '../../../../../../data/query-library/openapi.json';

try {
  // Check we have the OpenAPI before generating query library RTK APIs,
  // as this is currently a manual process
  accessSync(schemaFile);
} catch (e) {
  console.error('\nCould not find OpenAPI definition.\n');
  console.error(
    'Please visit /openapi/v3/apis/peakq.grafana.app/v0alpha1 and save the OpenAPI definition to data/query-library/openapi.json\n'
  );
  throw e;
}

const config: ConfigFile = {
  schemaFile,
  apiFile: '',
  tag: true,
  outputFiles: {
    '../endpoints.gen.ts': {
      apiFile: '../factory.ts',
      apiImport: 'queryLibraryApi',
      filterEndpoints: ['listQueryTemplate', 'createQueryTemplate', 'deleteQueryTemplate', 'updateQueryTemplate'],
      exportName: 'generatedQueryLibraryApi',
      flattenArg: false,
    },
  },
};

export default config;
