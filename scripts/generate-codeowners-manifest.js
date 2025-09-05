#!/usr/bin/env node

const fs = require('node:fs');
const { stat } = require('node:fs/promises');
const readline = require('node:readline');

const CODEOWNERS_COVERAGE_DIR = 'codeowners-manifest';
const RAW_AUDIT_JSONL_PATH = `${CODEOWNERS_COVERAGE_DIR}/audit-raw.jsonl`;
const TEAMS_BY_FILENAME_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/teams-by-filename.json`;
const FILENAMES_BY_TEAM_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/filenames-by-team.json`;
const TEAMS_JSON_PATH = `${CODEOWNERS_COVERAGE_DIR}/teams.json`;

(async function processFileLines() {
  try {
    const hasRawAuditJsonl = await stat(RAW_AUDIT_JSONL_PATH);
    if (!hasRawAuditJsonl) {
      throw new Error(
        `No raw CODEOWNERS audit JSONL file found at: ${RAW_AUDIT_JSONL_PATH} ... run "yarn codeowners-manifest:raw"`
      );
    }

    console.log(`📋 Generating files x teams manifests from ${RAW_AUDIT_JSONL_PATH} ...`);

    const auditFileInput = fs.createReadStream(RAW_AUDIT_JSONL_PATH);

    const teamsOutput = fs.createWriteStream(TEAMS_JSON_PATH);
    const teamsByFilenameOutput = fs.createWriteStream(TEAMS_BY_FILENAME_JSON_PATH);
    const filenamesByTeamOutput = fs.createWriteStream(FILENAMES_BY_TEAM_JSON_PATH);

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
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
