const fs = require('fs');
const path = require('path');

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

  // Udpate import declarations that import from barrel files
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

      // Update the import path appending '/index'
      path.node.source.value = path.node.source.value + '/index';
    });

  return root.toSource();
};
