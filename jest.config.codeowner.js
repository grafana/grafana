const fs = require('fs');
const open = require('open').default;
const path = require('path');

const baseConfig = require('./jest.config.js');
const { CODEOWNER_KIND, getCodeownerKind, createCodeownerSlug } = require('./scripts/codeowners-manifest/utils.js');

const CODEOWNER_KIND_DIRECTORY_MAPPINGS = {
  [CODEOWNER_KIND.TEAM]: 'teams',
  [CODEOWNER_KIND.USER]: 'users',
  [CODEOWNER_KIND.EMAIL]: 'emails',
};

/**
 * Creates a directory path for coverage reports
 * Groups by plural kind directory (teams/, users/, emails/)
 * @param {string} codeowner - CODEOWNERS codeowner (username, team, or email)
 * @returns {string} Directory path relative to coverage/by-team/
 */
function createCodeownerDirectory(codeowner) {
  const kind = getCodeownerKind(codeowner);
  const pluralKind = CODEOWNER_KIND_DIRECTORY_MAPPINGS[kind];
  const slug = createCodeownerSlug(codeowner);
  return `${pluralKind}/${slug}`;
}

const CODEOWNERS_MANIFEST_FILENAMES_BY_TEAM_PATH = 'codeowners-manifest/filenames-by-team.json';

const codeownerName = process.env.CODEOWNER_NAME;
if (!codeownerName) {
  console.error('ERROR: CODEOWNER_NAME environment variable is required');
  process.exit(1);
}

const outputDir = `./coverage/by-team/${createCodeownerDirectory(codeownerName)}`;
const COVERAGE_SUMMARY_OUTPUT_PATH = './coverage-summary.json';

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
    !path.matchesGlob(file, '**/graveyard/**/*')
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
  collectCoverageFrom: sourceFiles.map((file) => `<rootDir>/${file}`),
  coverageReporters: ['none'],
  coverageDirectory: '/tmp/jest-coverage-ignore',

  coverageProvider: 'v8',
  reporters: [
    'default',
    [
      'jest-monocart-coverage',
      {
        name: `Coverage Report - ${codeownerName} owned files`,
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

          writeCoverageSummaryArtifact(coverageResults);

          // TODO: Emit coverage metrics https://github.com/grafana/grafana/issues/111208
        },
      },
    ],
  ],

  testRegex: undefined,

  testMatch: testFiles.map((file) => `<rootDir>/${file}`),
};

function writeCoverageSummaryArtifact(coverageResults) {
  if (!coverageResults || !coverageResults.summary) {
    return;
  }

  const summary = {
    team: codeownerName,
    commit: process.env.GITHUB_SHA || 'unknown',
    timestamp: new Date().toISOString(),
    summary: {
      lines: { pct: coverageResults.summary.lines.pct },
      statements: { pct: coverageResults.summary.statements.pct },
      functions: { pct: coverageResults.summary.functions.pct },
      branches: { pct: coverageResults.summary.branches.pct },
    },
  };

  try {
    fs.writeFileSync(COVERAGE_SUMMARY_OUTPUT_PATH, JSON.stringify(summary, null, 2));
    console.log(`📊 Coverage summary written to ${COVERAGE_SUMMARY_OUTPUT_PATH}`);
  } catch (err) {
    console.error(`Failed to write coverage summary: ${err}`);
  }
}

async function openCoverageReport(reportURL) {
  try {
    await open(reportURL);
  } catch (err) {
    console.error(`Failed to open coverage report: ${err}`);
  }
}
