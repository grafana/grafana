#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

let includeInternalScripts = false;

const isLinkedMode = () => {
  // In circleci we are in linked mode. Detect by using the circle working directory,
  // rather than the present working directory.
  const pwd = process.env.CIRCLE_WORKING_DIRECTORY || process.env.PWD || process.cwd();

  if (path.basename(pwd) === 'grafana-toolkit') {
    return true;
  }

  try {
    const resolvedPath = require.resolve('@grafana/toolkit');
    return fs.lstatSync(resolvedPath).isSymbolicLink();
  } catch {
    return false;
  }
};

const entrypoint = () => {
  const entrypointBase = `${__dirname}/../src/cli/index`;
  const resolvedJsDir = path.resolve(`${entrypointBase}.js`);
  const resolvedTsDir = path.resolve(`${entrypointBase}.ts`);

  // IF we have a toolkit directory AND linked grafana toolkit AND the toolkit dir is a symbolic lik
  // THEN run everything in linked mode
  if (isLinkedMode() || !fs.existsSync(resolvedJsDir)) {
    console.log('Running in local/linked mode');
    // This bin is used for cli executed internally
    const tsProjectPath = path.resolve(__dirname, '../tsconfig.json');
    require('ts-node').register({
      project: tsProjectPath,
      transpileOnly: true,
    });

    includeInternalScripts = true;
    return resolvedTsDir;
  }

  // The default entrypoint must exist, return it now.
  return resolvedJsDir;
};

require(entrypoint()).run(includeInternalScripts);
