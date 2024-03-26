const path = require('path');

function defaultIndexTemplate(filePaths) {
  const exportEntries = filePaths.map(({ path: filePath }) => {
    const basename = path.basename(filePath, path.extname(filePath));
    const exportName = /^\d/.test(basename) ? `Svg${basename}` : basename;
    return `export { default as ${exportName} } from './icons-gen/${basename}'`;
  });
  return ["export { type IconProps } from './IconBase';", ...exportEntries].join('\n');
}

module.exports = defaultIndexTemplate;
