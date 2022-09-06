const fs = require('fs');
const os = require('os');
const path = require('path');

const cachedListPath = path.join(__dirname, '../src/components/Icon/cached.json');
const iconsList = require(cachedListPath);

const iconsBundleJsTemplatePath = path.join(__dirname, '../src/components/Icon/iconBundle.ts.template');
const iconsBundleJsPath = path.join(__dirname, '../src/components/Icon/iconBundle.ts');

const iconsBundleJsTemplate = fs.readFileSync(iconsBundleJsTemplatePath).toString();

const importsStatements = [];
const cacheStatements = [];

const grafanaIconsPublicPath = '../../../../../public/img/icons/';

function generateIconBundle({ outputPath, verbose = false }) {
  const modulePrefix = 'u';
  let moduleNameCount = 1000;

  for (iconEntry of iconsList) {
    // skip empty and commented
    if (iconEntry === '' || iconEntry.startsWith('#')) {
      continue;
    }

    importsStatements.push(
      `import ${modulePrefix}${moduleNameCount} from '${grafanaIconsPublicPath}${iconEntry}.svg';`
    );
    cacheStatements.push(`  cacheItem(${modulePrefix}${moduleNameCount}, '${iconEntry}.svg');`);
    moduleNameCount++;
  }
  const output = iconsBundleJsTemplate
    .replace('//{{imports}}', importsStatements.join('\n'))
    .replace('//{{cacheItems}}', cacheStatements.join('\n'));

  fs.writeFileSync(outputPath, output);
  if (verbose) {
    console.log('The iconsBundle file was successfully written.');
    console.log(`The file is located at ${outputPath}`);
  }
  return outputPath;
}

// if invoked directly
if (require.main === module) {
  generateIconBundle({ outputPath: iconsBundleJsPath, verbose: true });
}

module.exports = generateIconBundle;
