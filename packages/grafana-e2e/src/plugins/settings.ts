// Not sure yet if e2e should import from g/ui
// import { PluginMeta } from '@grafana/ui';

import path from 'path';
import fs from 'fs';
import { constants } from '../common/constants';

export interface Settings {
  plugin: any;
  // ads of comment on to
  // plugin: PluginMeta;
  outputFolder: string;
}

let env: Settings | null = null;

export function getEndToEndSettings() {
  if (env) {
    return env;
  }

  let f = path.resolve(process.cwd(), 'ci', 'dist', 'plugin.json');
  if (!fs.existsSync(f)) {
    f = path.resolve(process.cwd(), 'dist', 'plugin.json');
    if (!fs.existsSync(f)) {
      f = path.resolve(process.cwd(), 'src', 'plugin.json');
    }
  }
  const outputFolder = path.resolve(process.cwd(), 'e2e-results');
  if (!fs.existsSync(outputFolder)) {
    fs.mkdirSync(outputFolder, { recursive: true });
  }
  constants.screenShotsTruthDir = path.resolve(process.cwd(), 'e2e', 'truth');
  constants.screenShotsOutputDir = outputFolder;

  return (env = {
    plugin: require(f) as any,
    outputFolder,
  });
}
