const path = require('node:path');

function isCoverageSourceFile(file) {
  file = file.replace(/\\/g, '/').replace(/^\.\//, '');
  const ext = path.extname(file);
  return (
    ['.ts', '.tsx', '.js', '.jsx'].includes(ext) &&
    // exclude all tests and mocks
    !path.matchesGlob(file, '**/test/**/*') &&
    !file.includes('.test.') &&
    !file.includes('.spec.') &&
    !path.matchesGlob(file, '**/__mocks__/**/*') &&
    // and storybook stories
    !file.includes('.story.') &&
    // and generated files
    !file.includes('.gen.ts') &&
    // and type definitions
    !file.includes('.d.ts') &&
    !file.endsWith('/types.ts') &&
    // and anything in graveyard
    !path.matchesGlob(file, '**/graveyard/**/*') &&
    // and scripts directory
    !file.startsWith('scripts/') &&
    !file.startsWith('e2e-playwright/') &&
    // and jest config files
    !path.matchesGlob(file, '**/jest.config*.js') &&
    !file.endsWith('/module.tsx')
  );
}

module.exports = { isCoverageSourceFile };
