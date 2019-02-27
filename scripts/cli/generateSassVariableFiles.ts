import fs from 'fs';
import darkTheme from '@grafana/ui/src/themes/dark';
import lightTheme from '@grafana/ui/src/themes/light';
import defaultTheme from '@grafana/ui/src/themes/default';
import { darkThemeVarsTemplate } from '@grafana/ui/src/themes/_variables.dark.scss.tmpl';
import { lightThemeVarsTemplate } from '@grafana/ui/src/themes/_variables.light.scss.tmpl';
import { commonThemeVarsTemplate } from '@grafana/ui/src/themes/_variables.scss.tmpl';

const darkThemeVariablesPath = __dirname + '/../../public/sass/_variables.dark.generated.scss';
const lightThemeVariablesPath = __dirname + '/../../public/sass/_variables.light.generated.scss';
const defaultThemeVariablesPath = __dirname + '/../../public/sass/_variables.generated.scss';

const writeVariablesFile = async (path: string, data: string) => {
  return new Promise((resolve, reject) => {
    fs.writeFile(path, data, e => {
      if (e) {
        reject(e);
      } else {
        resolve(data);
      }
    });
  });
};

const generateSassVariableFiles = async () => {
  try {
    await Promise.all([
      writeVariablesFile(darkThemeVariablesPath, darkThemeVarsTemplate(darkTheme)),
      writeVariablesFile(lightThemeVariablesPath, lightThemeVarsTemplate(lightTheme)),
      writeVariablesFile(defaultThemeVariablesPath, commonThemeVarsTemplate(defaultTheme)),
    ]);
    console.log('\nSASS variable files generated');
  } catch (error) {
    console.error('\nWriting SASS variable files failed', error);
    process.exit(1);
  }
};

generateSassVariableFiles();
