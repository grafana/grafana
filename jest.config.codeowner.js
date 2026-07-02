const fs = require('fs');
const path = require('path');

const baseConfig = require('./jest.config.js');
const { buildCodeownerDirectoryPath } = require('./scripts/codeowners-manifest/utils.js');

const CODEOWNERS_MANIFEST_FILENAMES_BY_TEAM_PATH = 'codeowners-manifest/filenames-by-team.json';

const codeownerName = process.env.CODEOWNER_NAME;
if (!codeownerName) {
  console.error('ERROR: CODEOWNER_NAME environment variable is required');
  process.exit(1);
}

const outputDir = path.join('./coverage/by-team', buildCodeownerDirectoryPath(codeownerName));

const codeownersFilePath = path.join(__dirname, CODEOWNERS_MANIFEST_FILENAMES_BY_TEAM_PATH);

if (!fs.existsSync(codeownersFilePath)) {
  console.error(`Codeowners file not found at ${codeownersFilePath} ...`);
  console.error('Please run: yarn codeowners-manifest first to generate the mapping file');
  process.exit(1);
}

const codeownersData = JSON.parse(fs.readFileSync(codeownersFilePath, 'utf8'));
const teamFiles = codeownersData[codeownerName] || [];

if (teamFiles.length === 0) {
  console.error(`ERROR: No files found for team "${codeownerName}"`);
  console.error('Available teams:', Object.keys(codeownersData).join(', '));
  process.exit(1);
}

const sourceFiles = teamFiles.filter((file) => {
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
    // and jest config files
    !path.matchesGlob(file, '**/jest.config*.js') &&
    !file.endsWith('/module.tsx')
  );
});

const testFiles = teamFiles.filter((file) => {
  const ext = path.extname(file);
  return ['.ts', '.tsx', '.js', '.jsx'].includes(ext) && (file.includes('.test.') || file.includes('.spec.'));
});

if (testFiles.length === 0) {
  console.log(`No test files found for team ${codeownerName}`);
  process.exit(0);
}

console.log(
  `🧪 Collecting coverage for ${sourceFiles.length} testable files and running ${testFiles.length} test files of ${teamFiles.length} files owned by ${codeownerName}.`
);

module.exports = {
  ...baseConfig,

  collectCoverage: true,
  // collectCoverageFrom scopes the report to the team's owned source files and includes untested
  // ones at 0%, so the reporters need no extra filtering (this replaces monocart's sourceFilter/all).
  collectCoverageFrom: sourceFiles.map((file) => `<rootDir>/${file}`),
  coverageProvider: 'babel',
  coverageDirectory: outputDir,
  // html `subdir: 'html'` keeps the CI artifact path (<outputDir>/html) stable; json-summary feeds
  // the per-team summary artifact assembled after the run in test-coverage-by-codeowner.js.
  coverageReporters: [['html', { subdir: 'html' }], 'json-summary', 'lcov', 'text-summary'],

  testRegex: undefined,

  testMatch: testFiles.map((file) => `<rootDir>/${file}`),
};
