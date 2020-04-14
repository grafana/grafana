#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let includeInternalScripts = true;

const isLinkedMode = () => {
  let pwd = process.env['PWD'];

  // In circleci we are in linked mode. Detect by using the circle working directory,
  // rather than the present working directory.
  if (process.env['CIRCLE_WORKING_DIRECTORY']) {
    pwd = process.env['CIRCLE_WORKING_DIRECTORY'];
  }

  if (path.basename(pwd) === 'grafana-toolkit') {
    return true;
  }

  const linkedDir = `${pwd}/node_modules/@grafana/toolkit`.replace('~', process.env.HOME);
  if (fs.existsSync(linkedDir)) {
    const tkStat = fs.lstatSync(linkedDir);
    if (tkStat.isSymbolicLink()) {
      return true;
    }
  }

  return false;
};

const entrypoint = () => {
  const defaultEntryPoint = `${__dirname}/../src/cli/index.js`;

  // IF we have a toolkit directory AND linked grafana toolkit AND the toolkit dir is a symbolic lik
  // THEN run everything in linked mode
  if (isLinkedMode()) {
    console.log('Running in typescript/linked mode');
    // This bin is used for cli executed internally
    var tsProjectPath = path.resolve(__dirname, '../tsconfig.json');
    require('ts-node').register({
      project: tsProjectPath,
      transpileOnly: true,
    });

    includeInternalScripts = true;
    return '../src/cli/index.ts';
  }

  // We are using npx, and a relative path does not find index.js
  if (!fs.existsSync(defaultEntryPoint) && fs.existsSync(`${__dirname}/../dist/src/cli/index.js`)) {
    return `${__dirname}/../dist/src/cli/index.js`;
  }

  // The default entrypoint must exist, return it now.
  return defaultEntryPoint;
};

require(entrypoint()).run(includeInternalScripts);
