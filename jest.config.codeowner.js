const child_process = require('child_process');
const fs = require('fs');
const open = require('open');
const path = require('path');

const baseConfig = require('./jest.config.js');

const CODEOWNERS_MANIFEST_FILENAMES_BY_TEAM_PATH = 'codeowners-manifest/filenames-by-team.json';

const teamName = process.env.TEAM_NAME;
if (!teamName) {
  console.error('ERROR: TEAM_NAME environment variable is required');
  process.exit(1);
}

const outputDir = `./coverage/by-team/${createOwnerDirectory(teamName)}`;

const codeownersFilePath = path.join(__dirname, CODEOWNERS_MANIFEST_FILENAMES_BY_TEAM_PATH);

if (!fs.existsSync(codeownersFilePath)) {
  console.error(`Codeowners file not found at ${codeownersFilePath} ...`);
  console.error('Please run: yarn codeowners-manifest first to generate the mapping file');
  process.exit(1);
}

const codeownersData = JSON.parse(fs.readFileSync(codeownersFilePath, 'utf8'));
const teamFiles = codeownersData[teamName] || [];

if (teamFiles.length === 0) {
  console.error(`ERROR: No files found for team "${teamName}"`);
  console.error('Available teams:', Object.keys(codeownersData).join(', '));
  process.exit(1);
}

const sourceFiles = teamFiles.filter((file) => {
  const ext = path.extname(file);
  return (
    ['.ts', '.tsx', '.js', '.jsx'].includes(ext) &&
    !file.includes('.test.') &&
    !file.includes('.spec.') &&
    !file.includes('.story.') &&
    !file.includes('.gen.ts') &&
    !file.includes('.d.ts') &&
    !file.endsWith('/types.ts')
  );
});

const testFiles = teamFiles.filter((file) => {
  const ext = path.extname(file);
  return ['.ts', '.tsx', '.js', '.jsx'].includes(ext) && (file.includes('.test.') || file.includes('.spec.'));
});

if (testFiles.length === 0) {
  console.log(`No test files found for team ${teamName}`);
  process.exit(0);
}

console.log(
  `🧪 Collecting coverage for ${sourceFiles.length} testable files and running ${testFiles.length} test files of ${teamFiles.length} files owned by ${teamName}.`
);

module.exports = {
  ...baseConfig,

  collectCoverage: true,
  collectCoverageFrom: sourceFiles.map((file) => `<rootDir>/${file}`),
  coverageReporters: ['none'],
  coverageDirectory: '/tmp/jest-coverage-ignore',

  coverageProvider: 'v8',
  reporters: [
    'default',
    [
      'jest-monocart-coverage',
      {
        name: `Coverage Report - ${teamName} owned files`,
        outputDir: outputDir,
        reports: ['console-summary', 'v8', 'json', 'lcov'],
        sourceFilter: (coveredFile) => sourceFiles.includes(coveredFile),
        all: {
          dir: ['./packages', './public'],
          filter: (filePath) => {
            const relativePath = filePath.replace(process.cwd() + '/', '');
            return sourceFiles.includes(relativePath);
          },
        },
        cleanCache: true,
        onEnd: (coverageResults) => {
          const reportURL = `file://${path.resolve(outputDir)}/index.html`;
          console.log(`📄 Coverage report saved to ${reportURL}`);

          if (process.env.SHOULD_OPEN_COVERAGE_REPORT === 'true') {
            openCoverageReport(reportURL);
          }

          // TODO: Emit coverage metrics https://github.com/grafana/grafana/issues/111208
        },
      },
    ],
  ],

  testRegex: undefined,

  testMatch: testFiles.map((file) => `<rootDir>/${file}`),
};

/**
 * Create a filesystem-safe directory structure for different owner types
 * @param {string} owner - CODEOWNERS owner (username, team, or email)
 * @returns {string} Directory path relative to coverage/by-team/
 */
function createOwnerDirectory(owner) {
  if (owner.includes('@') && owner.includes('/')) {
    // Example: @grafana/dataviz-squad
    const [org, team] = owner.substring(1).split('/');
    return `teams/${org}/${team}`;
  } else if (owner.startsWith('@')) {
    // Example: @jesdavpet
    return `users/${owner.substring(1)}`;
  } else {
    // Example: user@domain.tld
    const [user, domain] = owner.split('@');
    return `emails/${user}-at-${domain}`;
  }
}

/**
 * Open the given file URL in the default browser safely, without shell injection risk.
 * @param {string} reportURL
 */
async function openCoverageReport(reportURL) {
  try {
    await open(reportURL);
  } catch (err) {
    console.error(`Failed to open coverage report: ${err}`);
  }
}
