const fs = require('fs');

const cwd = process.cwd();
const packageJson = require(`${cwd}/package.json`);

const newPackageJson = {
  ...packageJson,
  main: packageJson.publishConfig?.main ?? packageJson.main,
};

if (packageJson.publishConfig?.types) {
  newPackageJson.types = packageJson.publishConfig.types;
}

if (packageJson.publishConfig?.module) {
  newPackageJson.module = packageJson.publishConfig.module;
}

try {
  fs.writeFileSync(`${cwd}/package.json`, JSON.stringify(newPackageJson, null, 2));
} catch (e) {}
