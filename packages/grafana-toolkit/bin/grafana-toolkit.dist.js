#!/usr/bin/env node

const fs = require('fs');

entrypoint = () => {
    const defaultEntryPoint = '../src/cli/index.js';
    // We are running in dev mode. Don't use compiled binaries, rather use the dev entrypoint.
    if (fs.existsSync(`${process.env['HOME']}/.config/yarn/link/@grafana/toolkit`)) {
        console.log('Running in linked mode');
        return `${__dirname}/grafana-toolkit.js`
    }

    // We are using npx, and a relative path does not find index.js
    if (!fs.existsSync(defaultEntryPoint) && fs.existsSync(`${__dirname}/../dist/src/cli/index.js`)) {
        return `${__dirname}/../dist/src/cli/index.js`;
    }
  
    // The default entrypoint must exist, return it now.
    return defaultEntryPoint;
}

require(entrypoint()).run();
