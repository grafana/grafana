const fs = require('fs');
const path = require('path');

function copyFiles(files, cwd, distDir) {
  for (const file of files) {
    const basedir = path.dirname(`${distDir}/${file}`);
    const name = file.replace('.generated', '');
    if (!fs.existsSync(basedir)) {
      fs.mkdirSync(basedir, { recursive: true });
    }
    fs.copyFileSync(`${cwd}/${file}`, `${distDir}/${name}`);
  }
}
const configFilesToCopy = [
  'src/config/prettier.plugin.config.json',
  'src/config/prettier.plugin.rc.js',
  'src/config/tsconfig.plugin.json',
  'src/config/tsconfig.plugin.local.json',
  'src/config/eslint.plugin.js',
  'src/config/styles.mock.js',
  'src/config/jest.babel.config.js',
  'src/config/jest.plugin.config.local.js',
  'src/config/matchMedia.js',
  'src/config/react-inlinesvg.tsx',
];
const sassFilesToCopy = [
  '_variables.generated.scss',
  '_variables.dark.generated.scss',
  '_variables.light.generated.scss',
];

const cwd = path.resolve(__dirname, '../');
const distPath = path.resolve(cwd, 'dist');
const sassPath = path.resolve(cwd, 'sass');
const grafanaSassPath = path.resolve(cwd, '../../public/sass');

copyFiles(configFilesToCopy, cwd, distPath);
copyFiles(sassFilesToCopy, grafanaSassPath, sassPath);
