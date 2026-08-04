export interface Variant {
  /** Repo-relative dir holding <group>/<version>/ subtrees */
  clientBase: string;
  /** Repo-relative path to the rtk-query codegen config */
  codegenScript: string;
  /** Repo-relative dir holding processed OpenAPI snapshots */
  openapiSnapshots: string;
  /** Command that regenerates endpoints.gen.ts */
  generateCommand: string;
  /** Import lines emitted into baseAPI.ts */
  baseAPIImports: string;
}

export const MARKERS = {
  CONFIG: '// GENERATED:API_CLIENT — used by the API client generator',
  IMPORT: '// GENERATED:IMPORT',
  REDUCER: '// GENERATED:REDUCER',
  MIDDLEWARE: '// GENERATED:MIDDLEWARE',
} as const;

export const PACKAGE_ROOT = 'packages/grafana-api-clients';

const OSS: Variant = {
  clientBase: `${PACKAGE_ROOT}/src/clients/rtkq`,
  codegenScript: `${PACKAGE_ROOT}/src/scripts/generate-rtk-apis.ts`,
  openapiSnapshots: 'pkg/tests/apis/openapi_snapshots',
  generateCommand: 'pnpm run generate-apis',
  baseAPIImports: `import { getAPIBaseURL } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';`,
};

const ENTERPRISE: Variant = {
  clientBase: 'public/app/extensions/api/clients',
  codegenScript: 'local/generate-enterprise-apis.ts',
  openapiSnapshots: 'pkg/extensions/apiserver/tests/openapi_snapshots',
  generateCommand:
    'pnpm --filter @grafana/openapi run process-specs && npx rtk-query-codegen-openapi ./local/generate-enterprise-apis.ts',
  baseAPIImports: `import { getAPIBaseURL } from '@grafana/api-clients';
import { createBaseQuery } from '@grafana/api-clients/rtkq';`,
};

export function variantFor(isEnterprise: boolean): Variant {
  return isEnterprise ? ENTERPRISE : OSS;
}
