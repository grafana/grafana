import { Task, TaskRunner } from './task';
import { pluginBuildRunner } from './plugin.build';
import { useSpinner } from '../utils/useSpinner';
import { restoreCwd } from '../utils/cwd';
import { getPluginJson } from '../../config/utils/pluginValidation';

// @ts-ignore
import execa = require('execa');
import path = require('path');
import fs = require('fs');
import tmp = require('tmp');

export interface PluginCIOptions {
  platform?: string;
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

/**
 * 1. BUILD
 *
 *  when platform exists it is building backend, otherwise frontend
 *
 *  Everything in /build folder
 *
 */
const buildPluginRunner: TaskRunner<PluginCIOptions> = async ({ platform }) => {
  const start = Date.now();
  const distDir = `${process.cwd()}/dist`;
  const buildDir = `${process.cwd()}/build`;
  const coverageDir = `${process.cwd()}/coverage`;
  if (!fs.existsSync(buildDir)) {
    fs.mkdirSync(buildDir);
  }

  if (platform) {
    console.log('TODO, backend support?');
    const stub = distDir + `/bin_${platform}`;
    if (!fs.existsSync(stub)) {
      fs.mkdirSync(stub);
    }
    fs.writeFile(stub + '/README.txt', 'TODO... build it!', err => {
      if (err) {
        throw new Error('Unable to write: ' + stub);
      }
    });
  } else {
    // Do regular build process
    await pluginBuildRunner({ coverage: true });
  }

  // Move dist & coverage into 'build'
  fs.renameSync(distDir, path.resolve(buildDir, 'dist'));
  fs.renameSync(coverageDir, path.resolve(buildDir, 'coverage'));

  const elapsed = Date.now() - start;
  const stats = {
    job: `${process.env.CIRCLE_JOB}`,
    sha1: `${process.env.CIRCLE_SHA1}`,
    startTime: start,
    buildTime: elapsed,
    endTime: Date.now(),
  };
  console.log('BUILD Info', stats);
};

export const ciBuildPluginTask = new Task<PluginCIOptions>('Build Plugin', buildPluginRunner);

/**
 * 2. BUNDLE
 *
 *  Take everything from /build/dist and zip it up
 *
 */
const bundlePluginRunner: TaskRunner<PluginCIOptions> = async () => {
  const start = Date.now();
  const distDir = `${process.cwd()}/build/dist`;
  if (!fs.existsSync(distDir)) {
    throw new Error('Dist folder does not exist: ' + distDir);
  }

  const artifactsDir = `${process.cwd()}/build/artifacts`;
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir);
  }

  const pluginInfo = getPluginJson(`${distDir}/plugin.json`);
  const zipName = pluginInfo.id + '-' + pluginInfo.info.version + '.zip';
  const zipFile = path.resolve(artifactsDir, zipName);
  process.chdir(distDir);
  await execa('zip', ['-r', zipFile, '.']);
  restoreCwd();

  const zipStats = fs.statSync(zipFile);
  if (zipStats.size < 100) {
    throw new Error('Invalid zip file: ' + zipFile);
  }

  const stats = {
    name: zipName,
    size: zipStats.size,
  };

  fs.writeFile(artifactsDir + '/info.json', JSON.stringify(stats, null, 2), err => {
    if (err) {
      throw new Error('Unable to write stats');
    }
    console.log('Created', stats);
  });
};

export const ciBundlePluginTask = new Task<PluginCIOptions>('Bundle Plugin', bundlePluginRunner);

/**
 * 3. Test (end-to-end)
 *
 *  deploy the zip to a running grafana instance
 *
 */
const testPluginRunner: TaskRunner<PluginCIOptions> = async ({ platform }) => {
  const start = Date.now();

  const artifactsDir = `${process.cwd()}/build/artifacts`;
  const infoFile = path.resolve(artifactsDir, 'info.json');
  const zipInfo = require(infoFile);
  const zipPath = path.resolve(artifactsDir, zipInfo.name);

  const tmpobj = tmp.dirSync();
  const pluginFolder = tmpobj.name;
  console.log('Temp Folder', pluginFolder);

  await execa('unzip', [zipPath, '-d', pluginFolder]);

  const { stdout } = await execa('ls', ['-Rl', pluginFolder]);
  console.log(stdout);

  // Manual cleanup
  tmpobj.removeCallback();

  fs.mkdirSync(pluginFolder, { recursive: true });

  const elapsed = Date.now() - start;
  const stats = {
    job: `${process.env.CIRCLE_JOB}`,
    sha1: `${process.env.CIRCLE_SHA1}`,
    startTime: start,
    buildTime: elapsed,
    endTime: Date.now(),
  };
  console.log('TODO Test', stats);
};

export const ciTestPluginTask = new Task<PluginCIOptions>('Test Plugin (e2e)', testPluginRunner);

/**
 * 4. Deploy
 *
 *  deploy the zip to a running grafana instance
 *
 */
const deployPluginRunner: TaskRunner<PluginCIOptions> = async () => {
  const start = Date.now();

  // TASK Time
  if (process.env.CIRCLE_INTERNAL_TASK_DATA) {
    const timingInfo = fs.readdirSync(`${process.env.CIRCLE_INTERNAL_TASK_DATA}`);
    if (timingInfo) {
      timingInfo.forEach(file => {
        console.log('TIMING INFO: ', file);
      });
    }
  }

  const elapsed = Date.now() - start;
  const stats = {
    job: `${process.env.CIRCLE_JOB}`,
    sha1: `${process.env.CIRCLE_SHA1}`,
    startTime: start,
    buildTime: elapsed,
    endTime: Date.now(),
  };
  console.log('TODO DEPLOY', stats);
};

export const ciDeployPluginTask = new Task<PluginCIOptions>('Deploy plugin', deployPluginRunner);
