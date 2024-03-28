const fs = require('fs');
const path = require('path');

// Function to get yarn link aliases from package.json
const getYarnLinkAliases = (packageJsonPath) => {
  if (!fs.existsSync(packageJsonPath)) {
    return {};
  }

  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const dependencies = packageJson.dependencies || {};
  const linkAliases = {};

  for (const [key, value] of Object.entries(dependencies)) {
    if (value.startsWith('link:')) {
      linkAliases[key] = value.substring(5); // Remove 'link:' prefix
    }
  }

  return linkAliases;
};

// Assuming package.json is in the root directory of the project
const packageJsonPath = path.join(__dirname, 'package.json');
const yarnLinkAliases = getYarnLinkAliases(packageJsonPath);

module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j.withParser('tsx')(fileInfo.source);
  const fileDir = path.dirname(fileInfo.path);

  // Function to check if the path potentially points to a barrel file
  const mightBeBarrelFileImport = (importPath) => {
    const fullPath = path.join(fileDir, importPath);
    if (fs.existsSync(fullPath) && fs.lstatSync(fullPath).isDirectory()) {
      if (fs.existsSync(path.join(fullPath, 'index.ts')) || fs.existsSync(path.join(fullPath, 'index.js'))) {
        return true;
      }
    }
    return false;
  };

  // Function to resolve import path considering yarn link aliases
  const resolveImportPath = (importPath) => {
    for (const [alias, actualPath] of Object.entries(yarnLinkAliases)) {
      if (importPath.startsWith(alias)) {
        return path.join(actualPath, importPath.substring(alias.length));
      }
    }
    return importPath;
  };

  // Replace import declarations that import from barrel files
  root
    .find(j.ImportDeclaration)
    .filter((path) => mightBeBarrelFileImport(path.node.source.value))
    .forEach((path) => {
      // Create a comment node
      const comment = j.commentLine(' @todo: replace barrel import path');

      // Attach the comment as a leading comment to the import declaration
      if (!path.node.comments) {
        path.node.comments = [];
      }
      path.node.comments.push(comment);

      // Replace the import path (this example simply appends '/index')
      path.node.source.value = path.node.source.value + '/index';
    });

  return root.toSource();
};
