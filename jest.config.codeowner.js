const fs = require('fs');
const path = require('path');

const baseConfig = require('./jest.config.js');

const CODEOWNERS_MANIFEST_FILENAMES_BY_TEAM_PATH = 'codeowners-manifest/filenames-by-team.json';

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

const teamDirectories = [...new Set(teamFiles.map((file) => path.dirname(file)))];
const teamTestPatterns = [];

teamFiles.forEach((file) => {
  if (['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(file))) {
    const dir = path.dirname(file);
    const basename = path.basename(file, path.extname(file));

    teamTestPatterns.push(`<rootDir>/${dir}/${basename}.test.{ts,tsx,js,jsx}`);
    teamTestPatterns.push(`<rootDir>/${dir}/__tests__/${basename}.test.{ts,tsx,js,jsx}`);
    teamTestPatterns.push(`<rootDir>/${dir}/__tests__/**/${basename}.test.{ts,tsx,js,jsx}`);
  }
});

teamDirectories.forEach((dir) => {
  teamTestPatterns.push(`<rootDir>/${dir}/**/*.test.{ts,tsx,js,jsx}`);
});

const uniqueTestPatterns = [...new Set(teamTestPatterns)];

console.log(
  `🧪 Collecting coverage for ${sourceFiles.length} testable files of ${teamFiles.length} files owned by ${teamName}.`
);

const sourcePaths = [
  ...new Set(
    sourceFiles.map((file) => {
      const parts = file.split('/');
      return parts.length > 1 ? parts[0] : '.';
    })
  ),
];

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
        reports: [['console-summary'], ['v8'], ['json'], ['lcov']], // Use v8 native Monocart format

        // Use specific directories and filter to only include team files
        all: {
          dir: [
            ...new Set(
              sourceFiles.map((file) => {
                const parts = file.split('/');
                // Get the top-level directory (packages, public, etc.)
                return parts.length > 1 ? parts[0] : '.';
              })
            ),
          ],
          filter: (filePath) => {
            // Only include files that are in our team's sourceFiles list
            return sourceFiles.includes(filePath);
          },
        },
        cleanCache: true,
        onEnd: (coverageResults) => {
          console.log(`📄 Coverage report saved to file://${path.resolve(outputDir)}/index.html`);
          // TODO: Emit coverage metrics https://github.com/grafana/grafana/issues/111208
        },
      },
    ],
  ],

  // Override base config's testRegex to avoid conflicts with testMatch
  testRegex: undefined,

  // Use specific test patterns for the team's files
  testMatch:
    uniqueTestPatterns.length > 0
      ? uniqueTestPatterns
      : [
          // Fallback pattern if no specific patterns found
          '<rootDir>/this-pattern-will-match-nothing/**/*.test.{ts,tsx,js,jsx}',
        ],
};
