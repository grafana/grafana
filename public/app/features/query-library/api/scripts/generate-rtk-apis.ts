/**
 * To generate query library k8s APIs, run:
 * `yarn process-specs && npx rtk-query-codegen-openapi ./public/app/features/query-library/api/scripts/generate-rtk-apis.ts` from the root of the repo
 */

import { ConfigFile } from '@rtk-query/codegen-openapi';
import { accessSync } from 'fs';

const schemaFile = '../../../../../../data/openapi/peakq.grafana.app-v0alpha1.json';

try {
  // Check we have the OpenAPI before generating query library RTK APIs,
  // as this is currently a manual process
  accessSync(schemaFile);
} catch (e) {
  console.error('\nCould not find OpenAPI definition.\n');
  console.error(
    'Please run go test pkg/tests/apis/openapi_test.go to generate the OpenAPI definition, then try running this script again.\n'
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
