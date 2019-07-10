import { Task, TaskRunner } from './task';
import { pluginBuildRunner } from './plugin.build';
import { restoreCwd } from '../utils/cwd';
import { getPluginJson } from '../../config/utils/pluginValidation';

// @ts-ignore
import execa = require('execa');
import path = require('path');
import fs = require('fs');

export interface PluginCIOptions {
  platform?: string;
  installer?: string;
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

const getWorkFolder = () => {
  let dir = `${process.cwd()}/work`;
  if (process.env.CIRCLE_JOB) {
    dir = path.resolve(dir, process.env.CIRCLE_JOB);
  }
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const writeWorkStats = (startTime: number, workDir: string) => {
  const elapsed = Date.now() - startTime;
  const stats = {
    job: `${process.env.CIRCLE_JOB}`,
    startTime,
    buildTime: elapsed,
    endTime: Date.now(),
  };
  const f = path.resolve(workDir, 'stats.json');
  fs.writeFile(f, JSON.stringify(stats, null, 2), err => {
    if (err) {
      throw new Error('Unable to stats: ' + f);
    }
  });
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
  const workDir = getWorkFolder();
  await execa('rimraf', [workDir]);
  fs.mkdirSync(workDir);

  if (platform) {
    console.log('TODO, backend support?');
    const file = path.resolve(workDir, 'README.txt');
    fs.writeFile(workDir + '/README.txt', 'TODO... build it!', err => {
      if (err) {
        throw new Error('Unable to write: ' + file);
      }
    });
  } else {
    // Do regular build process with coverage
    await pluginBuildRunner({ coverage: true });

    const distDir = `${process.cwd()}/dist`;
    const coverageDir = `${process.cwd()}/coverage`;

    // Move dist & coverage into workspace
    fs.renameSync(distDir, path.resolve(workDir, 'dist'));
    fs.renameSync(coverageDir, path.resolve(workDir, 'coverage'));
  }

  writeWorkStats(start, workDir);
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
  const workDir = getWorkFolder();

  // Copy all `dist` folders to a single dist folder
  const distDir = path.resolve(workDir, 'dist');
  fs.mkdirSync(distDir, { recursive: true });
  const dirs = fs.readdirSync(workDir);
  for (const dir of dirs) {
    if (dir.startsWith('build_')) {
      const contents = path.resolve(dir, 'dist');
      if (fs.existsSync(contents)) {
        await execa('cp', ['-rp', contents, distDir]);
      }
    }
  }

  // Create an artifact
  const artifactsDir = path.resolve(workDir, 'artifacts');
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
  await execa('sha1sum', [zipFile, '>', zipFile + '.sha1']);
  const info = {
    name: zipName,
    size: zipStats.size,
  };
  const f = path.resolve(artifactsDir, 'info.json');
  fs.writeFile(f, JSON.stringify(info, null, 2), err => {
    if (err) {
      throw new Error('Error writing artifact info: ' + f);
    }
  });

  writeWorkStats(start, workDir);
};

export const ciBundlePluginTask = new Task<PluginCIOptions>('Bundle Plugin', bundlePluginRunner);

/**
 * 3. Setup (install grafana and setup provisioning)
 *
 *  deploy the zip to a running grafana instance
 *
 */
const setupPluginRunner: TaskRunner<PluginCIOptions> = async ({ installer }) => {
  const start = Date.now();

  if (!installer) {
    throw new Error('Missing installer path');
  }

  // Download the grafana installer
  const workDir = getWorkFolder();
  const installFile = path.resolve(workDir, installer);
  if (!fs.existsSync(installFile)) {
    console.log('download', installer);
    const exe = await execa('wget', ['-O', installFile, 'https://dl.grafana.com/oss/release/' + installer]);
    console.log(exe.stdout);
  }

  // Find the plugin zip file
  const artifactsInfo = require(path.resolve(workDir, 'artifacts', 'info.json'));
  const pluginZip = path.resolve(workDir, 'artifacts', artifactsInfo.name);
  if (!fs.existsSync(pluginZip)) {
    throw new Error('Missing zip file:' + pluginZip);
  }

  // Create a grafana runtime folder
  const grafanaPluginsDir = path.resolve(require('os').homedir(), 'grafana', 'plugins');
  await execa('rimraf', [grafanaPluginsDir]);
  fs.mkdirSync(grafanaPluginsDir, { recursive: true });

  // unzip package.zip -d /opt
  let exe = await execa('unzip', [pluginZip, '-d', grafanaPluginsDir]);
  console.log(exe.stdout);

  // Write the custom settings
  const customIniPath = '/usr/share/grafana/conf/custom.ini';
  const customIniBody = `[paths] \n` + `plugins = ${grafanaPluginsDir}\n` + '';
  fs.writeFile(customIniPath, customIniBody, err => {
    if (err) {
      throw new Error('Unable to write: ' + customIniPath);
    }
  });

  console.log('Install Grafana');
  exe = await execa('sudo', ['dpkg', 'i', installFile]);
  console.log(exe.stdout);

  exe = await execa('sudo', ['grafana-server', 'start']);
  console.log(exe.stdout);
  exe = await execa('grafana-cli', ['--version']);

  writeWorkStats(start, workDir + '_setup');
};

export const ciSetupPluginTask = new Task<PluginCIOptions>('Setup Grafana', setupPluginRunner);

/**
 * 4. Test (end-to-end)
 *
 *  deploy the zip to a running grafana instance
 *
 */
const testPluginRunner: TaskRunner<PluginCIOptions> = async ({ platform }) => {
  const start = Date.now();
  const workDir = getWorkFolder();

  const args = {
    withCredentials: true,
    baseURL: process.env.GRAFANA_URL || 'http://localhost:3000/',
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

  console.log('TODO Puppeteer Tests', stats);
  writeWorkStats(start, workDir);
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
  console.log('TODO DEPLOY??', stats);
  console.log(' if PR => write a comment to github with difference ');
  console.log(' if master | vXYZ ==> upload artifacts to some repo ');
};

export const ciDeployPluginTask = new Task<PluginCIOptions>('Deploy plugin', deployPluginRunner);
