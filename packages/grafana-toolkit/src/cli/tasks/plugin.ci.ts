import { Task, TaskRunner } from './task';
import { pluginBuildRunner } from './plugin.build';
import { restoreCwd } from '../utils/cwd';
import { getPluginJson } from '../../config/utils/pluginValidation';

// @ts-ignore
import execa = require('execa');
import path = require('path');
import fs = require('fs');

export interface PluginCIOptions {
  dryRun?: boolean;
}

const calcJavascriptSize = (base: string, files?: string[]): number => {
  files = files || fs.readdirSync(base);
  let size = 0;

  if (files) {
    files.forEach(file => {
      const newbase = path.join(base, file);
      const stat = fs.statSync(newbase);
      if (stat.isDirectory()) {
        size += calcJavascriptSize(newbase, fs.readdirSync(newbase));
      } else {
        if (file.endsWith('.js')) {
          size += stat.size;
        }
      }
    });
  }
  return size;
};

const pluginCIRunner: TaskRunner<PluginCIOptions> = async ({ dryRun }) => {
  const start = Date.now();
  const distDir = `${process.cwd()}/dist`;
  const artifactsDir = `${process.cwd()}/artifacts`;
  await execa('rimraf', [`${process.cwd()}/coverage`]);
  await execa('rimraf', [artifactsDir]);

  // Do regular build process
  await pluginBuildRunner({ coverage: true });
  const elapsed = Date.now() - start;

  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir);
  }

  // TODO? can this typed from @grafana/ui?
  const pluginInfo = getPluginJson(`${distDir}/plugin.json`);
  const zipName = pluginInfo.id + '-' + pluginInfo.info.version + '.zip';
  const zipFile = path.resolve(artifactsDir, zipName);
  process.chdir(distDir);
  await execa('zip', ['-r', zipFile, '.']);
  restoreCwd();

  const stats = {
    startTime: start,
    buildTime: elapsed,
    jsSize: calcJavascriptSize(distDir),
    zipSize: fs.statSync(zipFile).size,
    endTime: Date.now(),
  };
  fs.writeFile(artifactsDir + '/stats.json', JSON.stringify(stats, null, 2), err => {
    if (err) {
      throw new Error('Unable to write stats');
    }
    console.log('Stats', stats);
  });

  if (!dryRun) {
    console.log('TODO send info to github?');
  }
};

export const pluginCITask = new Task<PluginCIOptions>('Plugin CI', pluginCIRunner);
