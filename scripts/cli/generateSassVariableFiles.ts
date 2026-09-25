import autoprefixer from 'autoprefixer';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'path';
import postcss from 'postcss';
import { compileAsync } from 'sass';

import { createTheme } from '@grafana/data';

import { darkThemeVarsTemplate } from './themeTemplates/_variables.dark.scss.tmpl';
import { lightThemeVarsTemplate } from './themeTemplates/_variables.light.scss.tmpl';
import { commonThemeVarsTemplate } from './themeTemplates/_variables.scss.tmpl';

const sassDirectory = resolve(__dirname, 'public', 'sass');
const darkThemeVariablesPath = resolve(sassDirectory, '_variables.dark.generated.scss');
const lightThemeVariablesPath = resolve(sassDirectory, '_variables.light.generated.scss');
const defaultThemeVariablesPath = resolve(sassDirectory, '_variables.generated.scss');

async function writeFileOrThrow(path: string, data: string) {
  await writeFile(path, data);
}

async function generateThemeCss(themeName: 'dark' | 'light') {
  const sourcePath = resolve(sassDirectory, `grafana.${themeName}.scss`);
  const outputPath = resolve(sassDirectory, `grafana.${themeName}.css`);
  const sassResult = await compileAsync(sourcePath, {
    silenceDeprecations: ['import', 'global-builtin'],
    style: 'expanded',
  });
  const postcssResult = await postcss([autoprefixer()]).process(sassResult.css, {
    from: sourcePath,
    to: outputPath,
  });

  await writeFileOrThrow(outputPath, postcssResult.css);
}

async function generateThemeStyles() {
  const darkTheme = createTheme();
  const lightTheme = createTheme({ colors: { mode: 'light' } });

  try {
    await mkdir(sassDirectory, { recursive: true });
    await Promise.all([
      writeFileOrThrow(darkThemeVariablesPath, darkThemeVarsTemplate(darkTheme)),
      writeFileOrThrow(lightThemeVariablesPath, lightThemeVarsTemplate(lightTheme)),
      writeFileOrThrow(defaultThemeVariablesPath, commonThemeVarsTemplate(darkTheme)),
    ]);
    await Promise.all([generateThemeCss('dark'), generateThemeCss('light')]);
  } catch (error) {
    console.error('\nGenerating theme CSS failed', error);
    process.exit(1);
  }
}

generateThemeStyles();
