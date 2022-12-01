const fs = require('fs');

const cwd = process.cwd();
const packageJson = require(`${cwd}/package.json`);

const newPackageJson = {
  ...packageJson,
  main: packageJson.publishConfig?.main ?? packageJson.main,
  types: packageJson.publishConfig?.types ?? packageJson.types,
};

try {
  fs.writeFileSync(`${cwd}/package.json`, JSON.stringify(newPackageJson, null, 2));
} catch (e) {}
