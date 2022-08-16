const fs = require('fs');
const path = require('path');

const cachedListPath = path.join(__dirname, '../src/icons/cached.txt');
const iconsBundleJsTemplatePath = path.join(__dirname, '../src/components/Icon/iconBundle.ts');
const iconsBundleTsPath = path.join(__dirname, '../src/components/Icon/iconBundle-generated.ts');

const iconsList = fs.readFileSync(cachedListPath).toString().split('\n');
const iconsBundleJsTemplate = fs.readFileSync(iconsBundleJsTemplatePath).toString();

const importsStatements = [];
const cacheStatements = [];

const grafanaIconsPublicPath = '../../../../../public/img/icons/';
const packageIconsPath = '../../icons/';

function generateIconBundle(outputPath = iconsBundleTsPath) {
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

  fs.writeFileSync(outputPath, output, (err) => {
    if (err) {
      console.error('There was an error writing the iconsBundle file: ', err);
      return;
    }
    console.log('The iconsBundle file was successfully written.');
  });
  return outputPath;
}

// if invoked directly
if (require.main === module) {
  generateIconBundle(iconsBundleTsPath);
}

module.exports = generateIconBundle;
