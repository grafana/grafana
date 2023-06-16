const readdir = require('node:fs').promises.readdir;

(async () => {
  for (const file of await readdir('transformations/light')) {
    const name = file.split('.')[0];
    console.log(`export const ${name} = {
      dark: require('./transformations/dark/${name}.svg'),
      light: require('./transformations/light/${name}.svg'),
    };\n`);
  }
})();
