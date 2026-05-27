import path from 'path';

import {
  formatFiles,
  getFilesToFormat,
  injectBeforeMarker,
  runGenerateApis,
  updatePackageJsonExports,
  writeNewFile,
} from './actions.ts';
import { runPrompts } from './prompts.ts';
import { renderBaseAPI, renderConfigEntry, renderIndexTs } from './templates.ts';

// Grafana root path
const basePath = path.resolve(import.meta.dirname, '../../../..');

const answers = await runPrompts(basePath);
const { groupName, version, reducerPath, isEnterprise } = answers;

const apiClientBasePath = isEnterprise
  ? 'public/app/extensions/api/clients'
  : 'packages/grafana-api-clients/src/clients/rtkq';
const generateScriptPath = isEnterprise
  ? 'local/generate-enterprise-apis.ts'
  : 'packages/grafana-api-clients/src/scripts/generate-rtk-apis.ts';

// Create baseAPI.ts and index.ts
writeNewFile(path.join(basePath, apiClientBasePath, groupName, version, 'baseAPI.ts'), renderBaseAPI(answers));
writeNewFile(path.join(basePath, apiClientBasePath, groupName, version, 'index.ts'), renderIndexTs());

// Add config entry to the generate script (inject before the marker so marker stays last)
injectBeforeMarker(
  path.join(basePath, generateScriptPath),
  '// PLOP_INJECT_API_CLIENT - Used by the API client generator',
  renderConfigEntry(answers)
);

// OSS-only: wire up Redux imports, reducers, middleware, and package.json exports
if (!isEnterprise) {
  const rtkqIndex = path.join(basePath, 'packages/grafana-api-clients/src/clients/rtkq/index.ts');

  injectBeforeMarker(
    rtkqIndex,
    '// PLOP_INJECT_IMPORT',
    `import { generatedAPI as ${reducerPath} } from './${groupName}/${version}';`
  );
  injectBeforeMarker(rtkqIndex, '// PLOP_INJECT_REDUCER', `  [${reducerPath}.reducerPath]: ${reducerPath}.reducer,`);
  injectBeforeMarker(rtkqIndex, '// PLOP_INJECT_MIDDLEWARE', `        ${reducerPath}.middleware,`);

  updatePackageJsonExports(basePath, groupName, version);
}

// Format all touched files, then run the RTK codegen
formatFiles(basePath, getFilesToFormat(groupName, version, isEnterprise));
runGenerateApis(basePath, isEnterprise);
