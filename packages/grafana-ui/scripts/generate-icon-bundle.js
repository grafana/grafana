const fs = require('fs');
const os = require('os');
const path = require('path');

const cachedListPath = path.join(__dirname, '../src/components/Icon/cached.json');
const iconsList = require(cachedListPath);

const iconsBundleJsTemplatePath = path.join(__dirname, '../src/components/Icon/iconBundle.ts');

const iconsBundleJsTemplate = fs.readFileSync(iconsBundleJsTemplatePath).toString();

const importsStatements = [];
const cacheStatements = [];

const grafanaIconsPublicPath = '../../../../../public/img/icons/';
const packageIconsPath = '../../icons/';

function generateIconBundle({ outputPath, verbose = false }) {
  const modulePrefix = 'u';
  let moduleNameCount = 1000;

  for (iconEntry of iconsList) {
    // skip empty and commented
    if (iconEntry === '' || iconEntry.startsWith('#')) {
      continue;
    }

    const mainPath = iconEntry.split('/')[0];

    // unicons are part of the grafana/ui pacakge
    if (mainPath === 'unicons') {
      importsStatements.push(`import ${modulePrefix}${moduleNameCount} from '${packageIconsPath}${iconEntry}.svg';`);
    } else {
      // other icons are part of the main grafana package
      importsStatements.push(
        `import ${modulePrefix}${moduleNameCount} from '${grafanaIconsPublicPath}${iconEntry}.svg';`
      );
    }
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
  const workingDir = fs.mkdtempSync(path.join(os.tmpdir(), 'icons-bundle'));
  const tempFile = path.join(workingDir, 'icons-bundle-generated.ts');
  generateIconBundle({ outputPath: tempFile, verbose: true });
}

module.exports = generateIconBundle;
