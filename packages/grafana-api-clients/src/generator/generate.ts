import path from 'path';

import {
  formatFiles,
  getExistingClientFiles,
  getFilesToFormat,
  hasAPIConfigEntry,
  injectBeforeMarker,
  runGenerateApis,
  updatePackageJsonExports,
  writeNewFile,
} from './actions.ts';
import { confirmUpdateExistingClient, runPrompts } from './prompts.ts';
import { renderBaseAPI, renderConfigEntry, renderIndexTs } from './templates.ts';
import { MARKERS, variantFor } from './variants.ts';

// Grafana root path
const basePath = path.resolve(import.meta.dirname, '../../../..');

const answers = await runPrompts(basePath);
const variant = variantFor(answers.isEnterprise);
const clientDir = path.join(basePath, variant.clientBase, answers.groupName, answers.version);

const isExistingClient = hasAPIConfigEntry(basePath, variant, answers.groupName, answers.version);

if (isExistingClient) {
  console.log(
    `API client ${answers.groupName}/${answers.version} is already configured. Update mode regenerates endpoints from the existing config and does not modify config, middleware, reducers, or package exports.`
  );

  if (await confirmUpdateExistingClient(answers.groupName, answers.version)) {
    runGenerateApis(basePath, variant);
  } else {
    console.log('No changes made.');
  }
} else {
  const existingClientFiles = getExistingClientFiles(basePath, variant, answers.groupName, answers.version);
  if (existingClientFiles.length > 0) {
    throw new Error(
      `Client files already exist for ${answers.groupName}/${answers.version}, but no config entry was found in ${variant.codegenScript}. Refusing to create a partial client. Existing files:\n${existingClientFiles.map((filePath) => `- ${filePath}`).join('\n')}`
    );
  }

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
}
