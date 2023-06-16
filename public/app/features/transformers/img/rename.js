const readdir = require('node:fs').promises.readdir;
const rename = require('node:fs').promises.rename;

(async () => {
  for (const file of await readdir('transformations/light')) {
    const [name, ext] = file.split('.');
    console.log({ name, ext });
    await rename(`transformations/light/${name}.${ext}`, `transformations/light/${name}.svg`);
  }
})();
