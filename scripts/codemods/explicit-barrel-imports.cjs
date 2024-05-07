const path = require('path');

const isBareSpecifier = (importPath) => !importPath.startsWith('app/') && /^[^./]/.test(importPath);
const barrelFileNames = ['index.ts', 'index.tsx', 'index.js', 'index.jsx'];

const resolvePath = (fileDir, importPath) => {
  if (importPath.startsWith('app/')) {
    const resolvedPath = require.resolve(path.join(process.cwd(), 'public', importPath));
    return resolvedPath;
  }

  return require.resolve(path.resolve(fileDir, importPath));
};

module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j.withParser('tsx')(fileInfo.source);
  const fileDir = path.dirname(fileInfo.path);
  // Update import declarations that import from barrel files
  root
    .find(j.ImportDeclaration)
    .filter((path) => !isBareSpecifier(path.node.source.value))
    .forEach((path) => {
      const resolvedPath = resolvePath(fileDir, path.node.source.value);
      if (barrelFileNames.some((barrelFileName) => resolvedPath.endsWith(barrelFileName))) {
        // Create a comment node
        const comment = j.commentLine(' @todo: replace barrel import path');

        // Attach the comment as a leading comment to the import declaration
        if (!path.node.comments) {
          path.node.comments = [];
        }
        path.node.comments.push(comment);

        // Update the import path appending '/index'
        path.node.source.value = path.node.source.value + '/index';
      }
    });

  return root.toSource({
    quote: 'single',
  });
};
