// import chokidar from 'chokidar';
import darkTheme from '@grafana/ui/src/themes/dark';
import { darkThemeVarsTemplate } from '@grafana/ui/src/themes/_variables.dark.scss.tmpl';
import fs from 'fs';

console.log(__dirname + '../../packages/grafana-ui/src/themes/dark.ts');

const fileToWatch = [
  __dirname + '/../../packages/grafana-ui/src/themes/dark.ts',
  __dirname + '/../../packages/grafana-ui/src/themes/light.ts',
];
// const watchService = chokidar.watch(fileToWatch);
console.log(`Watching for file changes on ${fileToWatch}`);

// watchService.on('change', path => {

const result = darkThemeVarsTemplate(darkTheme);
console.log(result);

fs.writeFile(__dirname + '/../../public/sass/_variables.dark.scss', result, e => {
  console.log(e);
});

// });
