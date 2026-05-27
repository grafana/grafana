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
import { MARKERS, variantFor } from './variants.ts';

// Grafana root path
const basePath = path.resolve(import.meta.dirname, '../../../..');

const answers = await runPrompts(basePath);
const variant = variantFor(answers.isEnterprise);
const clientDir = path.join(basePath, variant.clientBase, answers.groupName, answers.version);

// Create baseAPI.ts and index.ts
writeNewFile(path.join(clientDir, 'baseAPI.ts'), renderBaseAPI(answers, variant));
writeNewFile(path.join(clientDir, 'index.ts'), renderIndexTs());

// Add config entry to the generate script (inject before the marker so marker stays last)
injectBeforeMarker(path.join(basePath, variant.codegenScript), MARKERS.CONFIG, renderConfigEntry(answers));

// OSS-only: wire up Redux imports, reducers, middleware, and package.json exports
if (!answers.isEnterprise) {
  const rtkqIndex = path.join(basePath, variant.clientBase, 'index.ts');
  const { reducerPath, groupName, version } = answers;

  injectBeforeMarker(
    rtkqIndex,
    MARKERS.IMPORT,
    `import { generatedAPI as ${reducerPath} } from './${groupName}/${version}';`
  );
  injectBeforeMarker(rtkqIndex, MARKERS.REDUCER, `  [${reducerPath}.reducerPath]: ${reducerPath}.reducer,`);
  injectBeforeMarker(rtkqIndex, MARKERS.MIDDLEWARE, `        ${reducerPath}.middleware,`);

  updatePackageJsonExports(basePath, groupName, version);
}

// Format all touched files, then run the RTK codegen
formatFiles(basePath, getFilesToFormat(variant, answers.groupName, answers.version));
runGenerateApis(basePath, variant);
