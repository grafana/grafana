import path from 'path';

import { getClientGenerationState } from './clientState.ts';
import { formatFiles, getFilesToFormat, runGenerateApis } from './commands.ts';
import { injectBeforeMarkerIfMissing, writeNewFileIfMissing } from './files.ts';
import { updatePackageJsonExports } from './packageExports.ts';
import { confirmUpdateExistingClient, runPrompts } from './prompts.ts';
import { renderBaseAPI, renderConfigEntry, renderIndexTs, getRTKClientEntries } from './templates.ts';
import { MARKERS, variantFor } from './variants.ts';

async function main() {
  // Grafana root path
  const basePath = path.resolve(import.meta.dirname, '../../../..');

  const answers = await runPrompts(basePath);
  const variant = variantFor(answers.isEnterprise);
  const clientDir = path.join(basePath, variant.clientBase, answers.groupName, answers.version);
  const clientState = getClientGenerationState(basePath, variant, answers);

  if (clientState.isComplete) {
    console.log(
      `API client ${answers.groupName}/${answers.version} is already configured and wired. Update mode regenerates endpoints from the existing config and does not modify config, middleware, reducers, or package exports.`
    );

    if (await confirmUpdateExistingClient(answers.groupName, answers.version)) {
      runGenerateApis(basePath, variant);
    } else {
      console.log('No changes made.');
    }

    return;
  }

  const hasExistingClientState =
    clientState.hasConfigEntry ||
    clientState.existingClientFiles.length > 0 ||
    clientState.hasRTKImport ||
    clientState.hasRTKReducer ||
    clientState.hasRTKMiddleware ||
    clientState.hasPackageExport;

  if (hasExistingClientState) {
    console.warn(
      `⚠️ API client ${answers.groupName}/${answers.version} is partially configured. The generator will preserve existing files, add missing config/wiring/export entries, and regenerate endpoints. Missing:\n${clientState.missingParts.map((part) => `- ${part}`).join('\n')}`
    );
  }

  // Create baseAPI.ts and index.ts
  writeNewFileIfMissing(path.join(clientDir, 'baseAPI.ts'), renderBaseAPI(answers, variant));
  writeNewFileIfMissing(path.join(clientDir, 'index.ts'), renderIndexTs());

  // Add config entry to the generate script (inject before the marker so marker stays last)
  if (clientState.hasConfigEntry) {
    console.log(
      `✅ Config entry for ${answers.groupName}/${answers.version} already exists in ${variant.codegenScript}`
    );
  } else {
    injectBeforeMarkerIfMissing(path.join(basePath, variant.codegenScript), MARKERS.CONFIG, renderConfigEntry(answers));
  }

  // OSS-only: wire up Redux imports, reducers, middleware, and package.json exports
  if (!answers.isEnterprise) {
    const rtkqIndex = path.join(basePath, variant.clientBase, 'index.ts');
    const { reducerPath, groupName, version } = answers;
    const entries = getRTKClientEntries({ groupName, reducerPath, version });

    injectBeforeMarkerIfMissing(rtkqIndex, MARKERS.IMPORT, entries.importEntry);
    injectBeforeMarkerIfMissing(rtkqIndex, MARKERS.REDUCER, entries.reducerEntry);
    injectBeforeMarkerIfMissing(rtkqIndex, MARKERS.MIDDLEWARE, entries.middlewareEntry);

    updatePackageJsonExports(basePath, groupName, version);
  }

  // Format all touched files, then run the RTK codegen
  formatFiles(basePath, getFilesToFormat(variant, answers.groupName, answers.version));
  runGenerateApis(basePath, variant);
}

await main();
