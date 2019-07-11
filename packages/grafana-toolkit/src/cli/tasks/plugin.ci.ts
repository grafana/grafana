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

const getJobFromProcessArgv = () => {
  const arg = process.argv[2];
  if (arg && arg.startsWith('plugin:ci-')) {
    const task = arg.substring('plugin:ci-'.length);
    if ('build' === task) {
      if ('--platform' === process.argv[3] && process.argv[4]) {
        return task + '_' + process.argv[4];
      }
      return 'build_nodejs';
    }
    return task;
  }
  return 'unknown_job';
};

// /**
//  * Like cp -rn... BUT error if an destination file exists
//  */
// async function copyDirErrorIfExists(src:string,dest:string) {
//   const entries = await fs.readdirSync(src,{withFileTypes:true});
//   if(!fs.existsSync(dest)) {
//     fs.mkdirSync(dest);
//   }
//   console.log( 'DIR', src );
//   for(let entry of entries) {
//     const srcPath = path.join(src,entry.name);
//     const destPath = path.join(dest,entry.name);
//     if(entry.isDirectory()) {
//       await copyDirErrorIfExists(srcPath,destPath);
//     } else if(fs.existsSync(destPath)) {
//       console.log( 'XXXXXXXXXXXXXXX', destPath );
//       console.log( 'XXXXXXXXXXXXXXX', destPath );
//       throw new Error('Duplicate entry: '+destPath);
//     }
//     else {
//     //  console.log( 'COPY', destPath );
//       await fs.copyFileSync(srcPath,destPath);
//     }
//   }
// }

const job = process.env.CIRCLE_JOB || getJobFromProcessArgv();

const getJobFolder = () => {
  const dir = path.resolve(process.cwd(), 'ci', 'jobs', job);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const getCiFolder = () => {
  const dir = path.resolve(process.cwd(), 'ci');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

const writeJobStats = (startTime: number, workDir: string) => {
  const stats = {
    job,
    startTime,
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
 *  Each build writes data:
 *   ~/work/build_xxx/
 *
 *  Anything that should be put into the final zip file should be put in:
 *   ~/work/build_xxx/dist
 */
const buildPluginRunner: TaskRunner<PluginCIOptions> = async ({ platform }) => {
  const start = Date.now();
  const workDir = getJobFolder();
  await execa('rimraf', [workDir]);
  fs.mkdirSync(workDir);

  if (platform) {
    console.log('TODO, backend support?');
    fs.mkdirSync(path.resolve(process.cwd(), 'dist'));
    const file = path.resolve(process.cwd(), 'dist', `README_${platform}.txt`);
    fs.writeFile(file, `TODO... build ${platform}!`, err => {
      if (err) {
        throw new Error('Unable to write: ' + file);
      }
    });
  } else {
    // Do regular build process with coverage
    await pluginBuildRunner({ coverage: true });
  }

  // Move local folders to the scoped job folder
  for (const name of ['dist', 'coverage']) {
    const dir = path.resolve(process.cwd(), name);
    if (fs.existsSync(dir)) {
      fs.renameSync(dir, path.resolve(workDir, name));
    }
  }
  writeJobStats(start, workDir);
};

export const ciBuildPluginTask = new Task<PluginCIOptions>('Build Plugin', buildPluginRunner);

/**
 * 2. BUNDLE
 *
 *  Take everything from `~/ci/job/{any}/dist` and
 *  1. merge it into: `~/ci/dist`
 *  2. zip it into artifacts in `~/ci/artifacts`
 *  3. prepare grafana environment in: `~/ci/grafana-test-env`
 *
 */
const bundlePluginRunner: TaskRunner<PluginCIOptions> = async () => {
  const start = Date.now();
  const ciDir = getCiFolder();
  const artifactsDir = path.resolve(ciDir, 'artifacts');
  const distDir = path.resolve(ciDir, 'dist');
  const grafanaEnvDir = path.resolve(ciDir, 'grafana-test-env');
  await execa('rimraf', [artifactsDir, distDir, grafanaEnvDir]);
  fs.mkdirSync(artifactsDir);
  fs.mkdirSync(distDir);
  fs.mkdirSync(grafanaEnvDir);

  console.log('Build Dist Folder');

  // 1. Check for a local 'dist' folder
  const d = path.resolve(process.cwd(), 'dist');
  if (fs.existsSync(d)) {
    await execa('cp', ['-rn', d + '/.', distDir]);
  }

  // 2. Look for any 'dist' folders under ci/job/XXX/dist
  const dirs = fs.readdirSync(path.resolve(ciDir, 'jobs'));
  for (const j of dirs) {
    const contents = path.resolve(ciDir, 'jobs', j, 'dist');
    if (fs.existsSync(contents)) {
      try {
        await execa('cp', ['-rn', contents + '/.', distDir]);
      } catch (er) {
        throw new Error('Duplicate files found in dist folders');
      }
    }
  }

  console.log('Building ZIP');
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
  let sha1 = undefined;
  try {
    const exe = await execa('shasum', [zipFile]);
    const idx = exe.stdout.indexOf(' ');
    sha1 = exe.stdout.substring(0, idx);
    fs.writeFile(zipFile + '.sha1', sha1, err => {});
  } catch {
    console.warn('Unable to read SHA1 Checksum');
  }

  const info = {
    name: zipName,
    sha1,
    size: zipStats.size,
  };
  let p = path.resolve(artifactsDir, 'info.json');
  fs.writeFile(p, JSON.stringify(info, null, 2), err => {
    if (err) {
      throw new Error('Error writing artifact info: ' + p);
    }
  });

  console.log('Setup Grafan Environment');
  p = path.resolve(grafanaEnvDir, 'plugins', pluginInfo.id);
  fs.mkdirSync(p, { recursive: true });
  await execa('unzip', [zipFile, '-d', p]);

  // Write the custom settings
  p = path.resolve(grafanaEnvDir, 'custom.ini');
  const customIniBody =
    `# Autogenerated by @grafana/toolkit \n` +
    `[paths] \n` +
    `plugins = ${path.resolve(grafanaEnvDir, 'plugins')}\n` +
    `\n`; // empty line
  fs.writeFile(p, customIniBody, err => {
    if (err) {
      throw new Error('Unable to write: ' + p);
    }
  });

  writeJobStats(start, getJobFolder());
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
  const installDir = path.resolve(process.cwd(), '.installer');
  const installFile = path.resolve(installDir, installer);
  if (!fs.existsSync(installFile)) {
    if (!fs.existsSync(installDir)) {
      fs.mkdirSync(installDir);
    }
    console.log('download', installer);
    const exe = await execa('wget', ['-O', installFile, 'https://dl.grafana.com/oss/release/' + installer]);
    console.log(exe.stdout);
  }

  console.log('Install Grafana');
  let exe = await execa('sudo', ['apt-get', 'install', '-y', 'adduser', 'libfontconfig1']);
  exe = await execa('sudo', ['dpkg', '-i', installFile]);
  console.log(exe.stdout);

  const customIniFile = path.resolve(getCiFolder(), 'grafana-test-env', 'custom.ini');
  const configDir = '/usr/share/grafana/conf/';
  exe = await execa('sudo', ['cp', '-f', customIniFile, configDir]);
  console.log(exe.stdout);

  // sudo service grafana-server start
  console.log('Starting Grafana');
  exe = await execa('sudo', ['service', 'grafana-server', 'start']);
  console.log(exe.stdout);
  // exe = await execa('grafana-cli', ['--version', '--homepath', '/usr/share/grafana']);
  // console.log(exe.stdout);
  // exe = await execa('grafana-cli', ['plugins', 'ls', '--homepath', '/usr/share/grafana']);
  // console.log(exe.stdout);

  const dir = getJobFolder() + '_setup';
  await execa('rimraf', [dir]);
  fs.mkdirSync(dir);
  writeJobStats(start, dir);
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
  const workDir = getJobFolder();

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
    job,
    sha1: `${process.env.CIRCLE_SHA1}`,
    startTime: start,
    buildTime: elapsed,
    endTime: Date.now(),
  };

  console.log('TODO Puppeteer Tests', stats);
  writeJobStats(start, workDir);
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
    job,
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
