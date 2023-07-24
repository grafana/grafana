const execa = require('execa');
const fs = require('fs');
const path = require('path');
const resolveBin = require('resolve-bin');

function findClosestPackageJson(startPath) {
  let dir = path.isAbsolute(startPath) ? path.resolve(startPath) : path.resolve(process.cwd(), startPath);

  while (dir !== path.resolve('/')) {
    let packagePath = path.resolve(dir, 'package.json');
    if (fs.existsSync(packagePath)) {
      return packagePath;
    }
    dir = path.resolve(dir, '..');
  }
  throw new Error('No package.json file found!');
}

function getCypressVersion(cypressBin) {
  try {
    const { stdout } = execa.sync(cypressBin, ['--version']);
    const regex = /binary version: (\d+\.\d+\.\d+)/;
    const match = stdout.match(regex);
    if (match) {
      return match[1];
    }
    throw new Error('Cypress not found. Please install cypress first.');
  } catch (e) {
    throw new Error('Cypress not found. Please install cypress first.');
  }
}

function getCypressBinary() {
  // cypress shipped with this package. Probably 12
  const localCypressBin = resolveBin.sync('cypress');

  try {
    const requirePaths = require.main ? require.main.paths : module.paths;
    let requireOpts = {
      // do not search for cypress in the grafana packages
      paths: requirePaths.filter((p) => !p.includes('@grafana')),
    };
    const parentCypress = require.resolve('cypress', requireOpts);
    const parentCypressPackageJsonPath = findClosestPackageJson(parentCypress);
    const parentCypressPackageJson = require(parentCypressPackageJsonPath);
    const parentCypressBin = path.join(
      path.dirname(parentCypressPackageJsonPath),
      parentCypressPackageJson.bin.cypress
    );
    return parentCypressBin;
  } catch (e) {
    return localCypressBin;
  }
}

module.exports = {
  getCypressVersion,
  getCypressBinary,
};
