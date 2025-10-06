const fs = require('fs');
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
let teamFiles = [];

try {
  if (!fs.existsSync(codeownersFilePath)) {
    console.error(`Codeowners file not found at ${codeownersFilePath} ...`);
    console.error('Please run: yarn codeowners-manifest first to generate the mapping file');
    process.exit(1);
  }

  const codeownersData = JSON.parse(fs.readFileSync(codeownersFilePath, 'utf8'));
  teamFiles = codeownersData[teamName] || [];

  if (teamFiles.length === 0) {
    console.error(`ERROR: No files found for team "${teamName}"`);
    console.error('Available teams:', Object.keys(codeownersData).join(', '));
    process.exit(1);
  }
} catch (error) {
  console.error('ERROR: Failed to read or parse codeowners mapping file:', error.message);
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

const teamTestPatterns = [];

sourceFiles.forEach((file) => {
  const dir = path.dirname(file);
  const basename = path.basename(file, path.extname(file));

  teamTestPatterns.push(`<rootDir>/${dir}/${basename}.test.{ts,tsx,js,jsx}`);
  teamTestPatterns.push(`<rootDir>/${dir}/__tests__/${basename}.test.{ts,tsx,js,jsx}`);
  teamTestPatterns.push(`<rootDir>/${dir}/__tests__/**/${basename}.test.{ts,tsx,js,jsx}`);
});

console.log(
  `🧪 Collecting coverage for ${sourceFiles.length} testable files of ${teamFiles.length} files owned by ${teamName}.`
);

module.exports = {
  ...baseConfig,

  collectCoverage: true,
  coverageReporters: [],
  coverageDirectory: '/tmp/jest-coverage-ignore',

  coverageProvider: 'v8',
  reporters: [
    'default',
    [
      'jest-monocart-coverage',
      {
        name: `Coverage Report - ${teamName} owned files`,
        outputDir: outputDir,
        reports: [['console-summary'], ['v8'], ['json'], ['lcov']],

        all: {
          filter: (filePath) => sourceFiles.includes(filePath),
        },
        cleanCache: true,
        onEnd: (coverageResults) => {
          console.log(`📄 Coverage report saved to file://${path.resolve(outputDir)}/index.html`);
          // TODO: Emit coverage metrics https://github.com/grafana/grafana/issues/111208
        },
      },
    ],
  ],

  testRegex: undefined,

  testMatch:
    teamTestPatterns.length > 0
      ? teamTestPatterns
      : ['<rootDir>/this-pattern-will-match-nothing/**/*.test.{ts,tsx,js,jsx}'],
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
