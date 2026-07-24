export interface Variant {
  /** Repo-relative dir holding <group>/<version>/ subtrees */
  clientBase: string;
  /** Repo-relative path to the rtk-query codegen config */
  codegenScript: string;
  /** Repo-relative dir holding processed OpenAPI snapshots */
  openapiSnapshots: string;
  /** Executable for the generate command (no shell expansion) */
  generateCmd: string;
  /** Arguments for the generate command (no shell expansion) */
  generateArgs: readonly string[];
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
  generateCmd: 'yarn',
  generateArgs: ['generate-apis'],
  baseAPIImports: `import { getAPIBaseURL } from '../../../../utils/utils';
import { createBaseQuery } from '../../createBaseQuery';`,
};

const ENTERPRISE: Variant = {
  clientBase: 'public/app/extensions/api/clients',
  codegenScript: 'local/generate-enterprise-apis.ts',
  openapiSnapshots: 'pkg/extensions/apiserver/tests/openapi_snapshots',
  generateCmd: 'yarn',
  generateArgs: [
    'workspace',
    '@grafana/openapi',
    'process-specs',
    '&&',
    'npx',
    'rtk-query-codegen-openapi',
    './local/generate-enterprise-apis.ts',
  ],
  baseAPIImports: `import { getAPIBaseURL } from '@grafana/api-clients';
import { createBaseQuery } from '@grafana/api-clients/rtkq';`,
};

export function variantFor(isEnterprise: boolean): Variant {
  return isEnterprise ? ENTERPRISE : OSS;
}

/** Exhaustive list of permitted generate commands for API generation.
 *  Each entry is a [cmd, ...args] tuple derived from the known Variant
 *  definitions. runGenerateApis() validates the variant's cmd+args against
 *  this list before passing them to spawnSync, preventing command injection. */
export const ALLOWED_GENERATE_COMMANDS: ReadonlyArray<readonly [string, ...string[]]> = [
  [OSS.generateCmd, ...OSS.generateArgs],
  [ENTERPRISE.generateCmd, ...ENTERPRISE.generateArgs],
];

/** Exhaustive list of permitted base command prefixes for file formatting.
 *  runOrWarn() validates every command string against this list before
 *  passing it to spawnSync, preventing command-injection via crafted paths. */
export const ALLOWED_FORMAT_COMMANDS: readonly string[] = ['yarn eslint --fix', 'yarn prettier --write'];
