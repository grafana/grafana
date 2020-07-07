'use strict';
const { parse: parseYml } = require('yaml');
const {
  promises: { readFile },
} = require('fs');
const { resolve: resolvePath } = require('path');

const readProvision = filePath => readFile(filePath, 'utf8').then(contents => parseYml(contents));

const readProvisions = filePaths => Promise.all(filePaths.map(readProvision));

// Paths are relative to <project-root>/provisioning
module.exports = ({ CWD, filePaths }) =>
  readProvisions(filePaths.map(filePath => resolvePath(CWD, 'provisioning', filePath)));
