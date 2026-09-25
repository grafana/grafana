import { dynamicImportVarsPlugin, importGlobPlugin } from 'rolldown/experimental';

import { createPackageConfig } from '../rolldown.config.parts';

export default createPackageConfig({
  // dynamicImportVarsPlugin rewrites the locale import() to import.meta.glob, which importGlobPlugin then
  // expands into one import per locale file. Without the second plugin the CJS output throws at runtime.
  plugins: [dynamicImportVarsPlugin(), importGlobPlugin()],
});
