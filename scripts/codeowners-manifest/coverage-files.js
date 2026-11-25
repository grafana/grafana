const ignore = require('ignore');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const exclusions = ignore({ ignorecase: false }).add(readFileSync(path.join(__dirname, 'coverage.ignore'), 'utf8'));

function isCoverageSourceFile(file) {
  file = file.replace(/\\/g, '/').replace(/^\.\//, '');
  return ['.ts', '.tsx', '.js', '.jsx'].includes(path.extname(file)) && !exclusions.ignores(file);
}

module.exports = { isCoverageSourceFile };
