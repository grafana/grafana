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
 *  Everything in /ci-work folder
 *
 */
const buildPluginRunner: TaskRunner<PluginCIOptions> = async ({ platform }) => {
  const start = Date.now();
  const distDir = `${process.cwd()}/dist`;
  const buildDir = `${process.cwd()}/ci-work`;
  const coverageDir = `${process.cwd()}/coverage`;

  await execa('rimraf', [buildDir]);
  fs.mkdirSync(buildDir);

  if (platform) {
    console.log('TODO, backend support?');
    const stub = buildDir + `/bin_${platform}`;
    if (!fs.existsSync(stub)) {
      fs.mkdirSync(stub, { recursive: true });
    }
    fs.writeFile(stub + '/README.txt', 'TODO... build it!', err => {
      if (err) {
        throw new Error('Unable to write: ' + stub);
      }
    });
  } else {
    // Do regular build process
    await pluginBuildRunner({ coverage: true });

    // Move dist & coverage into workspace
    fs.renameSync(distDir, path.resolve(buildDir, 'dist'));
    fs.renameSync(coverageDir, path.resolve(buildDir, 'coverage'));
  }

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
 *  Take everything from /ci-work/dist and zip it up
 *
 */
const bundlePluginRunner: TaskRunner<PluginCIOptions> = async () => {
  const start = Date.now();
  let distDir = `${process.cwd()}/ci-work/dist`;
  if (!fs.existsSync(distDir)) {
    distDir = `${process.cwd()}/dist`;
    if (!fs.existsSync(distDir)) {
      throw new Error('Dist folder does not exist: ' + distDir);
    }
  }

  // Create an artifact
  const artifactsDir = `${process.cwd()}/ci-work/artifacts`;
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
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

  // Set up the docker folder structure
  const dockerDir = `${process.cwd()}/ci-work/docker`;
  const pluginFolder = path.resolve(dockerDir, 'plugin');
  fs.mkdirSync(pluginFolder, { recursive: true });
  await execa('unzip', [zipFile, '-d', pluginFolder]);

  let ex = await execa('ls', ['-Rl', pluginFolder]);
  console.log('Now load docker from:', ex.stdout);
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

  const args = {
    withCredentials: true,
    baseURL: 'http://localhost:3000/',
    responseType: 'json',
    auth: {
      username: 'admin',
      password: 'admin',
    },
  };

  const axios = require('axios');
  const frontendSettings = await axios.get('api/frontend/settings', args);

  console.log('Grafana Version: ' + JSON.stringify(frontendSettings.data.buildInfo, null, 2));

  const pluginInfo = getPluginJson(`${process.cwd()}/src/plugin.json`);
  const pluginSettings = await axios.get(`api/plugins/${pluginInfo.id}/settings`, args);

  console.log('Plugin Info: ' + JSON.stringify(pluginSettings.data, null, 2));

  console.log('TODO puppeteer');

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
