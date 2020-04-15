#!/usr/bin/env node

const fs = require('fs');

const entrypoint = () => {
  const defaultEntryPoint = '../src/cli/index.js';
  const toolkitDirectory = `${process.env['PWD']}/node_modules/@grafana/toolkit`;

  // IF we have a toolkit directory AND linked grafana toolkit AND the toolkit dir is a symbolic lik
  // THEN run everything in linked mode
  if (fs.existsSync(toolkitDirectory)) {
    const tkStat = fs.lstatSync(toolkitDirectory);
    if (tkStat.isSymbolicLink()) {
      console.log('Running in linked mode', `${__dirname}/grafana-toolkit.js`);
      return `${__dirname}/grafana-toolkit.js`;
    }
  }

  // We are using npx, and a relative path does not find index.js
  if (!fs.existsSync(defaultEntryPoint) && fs.existsSync(`${__dirname}/../dist/src/cli/index.js`)) {
    return `${__dirname}/../dist/src/cli/index.js`;
  }

  // The default entrypoint must exist, return it now.
  return defaultEntryPoint;
};

require(entrypoint());
