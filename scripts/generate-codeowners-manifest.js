#!/usr/bin/env node

const fs = require('node:fs');
const { stat } = require('node:fs/promises');
const readline = require('node:readline');

const CODEOWNERS_COVERAGE_DIR = 'codeowners-manifest';
const RAW_AUDIT_JSONL_PATH = `${CODEOWNERS_COVERAGE_DIR}/audit-raw.jsonl`;
const TEAMS_BY_FILENAME_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/teams-by-filename.json`;
const FILENAMES_BY_TEAM_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/filenames-by-team.json`;
const TEAMS_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/teams.json`;

/**
 * Generate codeowners manifest files from raw audit data
 * @param {string} rawAuditPath - Path to the raw audit JSONL file
 * @param {string} teamsPath - Path to write teams.json
 * @param {string} teamsByFilenamePath - Path to write teams-by-filename.json
 * @param {string} filenamesByTeamPath - Path to write filenames-by-team.json
 */
async function generateCodeownersManifest(rawAuditPath, teamsPath, teamsByFilenamePath, filenamesByTeamPath) {
  const hasRawAuditJsonl = await stat(rawAuditPath);
  if (!hasRawAuditJsonl) {
    throw new Error(
      `No raw CODEOWNERS audit JSONL file found at: ${rawAuditPath} ... run "yarn codeowners-manifest:raw"`
    );
  }

  const auditFileInput = fs.createReadStream(rawAuditPath);

  const teamsOutput = fs.createWriteStream(teamsPath);
  const teamsByFilenameOutput = fs.createWriteStream(teamsByFilenamePath);
  const filenamesByTeamOutput = fs.createWriteStream(filenamesByTeamPath);

  const lineReader = readline.createInterface({
    input: auditFileInput,
    crlfDelay: Infinity,
  });

  let teams = new Set();
  let teamsByFilename = {};
  let filenamesByTeam = {};

  lineReader.on('line', (line) => {
    const { path, owners } = JSON.parse(line.toString().trim());

    for (let owner of owners) {
      teams.add(owner);
    }

    teamsByFilename[path] = owners;

    for (let owner of owners) {
      const filenames = filenamesByTeam[owner] || [];
      filenamesByTeam[owner] = filenames.concat(path);
    }
  });

  await new Promise((resolve) => lineReader.once('close', resolve));

  teamsOutput.write(JSON.stringify(Array.from(teams).sort(), null, 2));
  teamsByFilenameOutput.write(JSON.stringify(teamsByFilename, null, 2));
  filenamesByTeamOutput.write(JSON.stringify(filenamesByTeam, null, 2));
}

if (require.main === module) {
  (async () => {
    try {
      console.log(`📋 Generating files ↔ teams manifests from ${RAW_AUDIT_JSONL_PATH} ...`);
      await generateCodeownersManifest(
        RAW_AUDIT_JSONL_PATH,
        TEAMS_JSON_PATH,
        TEAMS_BY_FILENAME_JSON_PATH,
        FILENAMES_BY_TEAM_JSON_PATH
      );
      console.log('✅ Codeowners manifest generation completed:');
      console.log(`   • ${TEAMS_JSON_PATH}`);
      console.log(`   • ${TEAMS_BY_FILENAME_JSON_PATH}`);
      console.log(`   • ${FILENAMES_BY_TEAM_JSON_PATH}`);
    } catch (e) {
      console.error(e);
      process.exit(1);
    }
  })();
}

module.exports = { generateCodeownersManifest };
