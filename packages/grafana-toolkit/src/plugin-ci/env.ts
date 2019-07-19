import execa = require('execa');
import path = require('path');
import fs from 'fs';
import { PluginBuildInfo } from '@grafana/ui';
import { JobInfo } from './types';

const getJobFromProcessArgv = () => {
  const arg = process.argv[2];
  if (arg && arg.startsWith('plugin:ci-')) {
    const task = arg.substring('plugin:ci-'.length);
    if ('build' === task) {
      if ('--backend' === process.argv[3] && process.argv[4]) {
        return task + '_' + process.argv[4];
      }
      return 'build_plugin';
    }
    return task;
  }
  return 'unknown_job';
};

export const job = process.env.CIRCLE_JOB || getJobFromProcessArgv();

export const getPluginBuildInfo = async (): Promise<PluginBuildInfo> => {
  if (process.env.CIRCLE_SHA1) {
    return Promise.resolve({
      time: Date.now(),
      repo: process.env.CIRCLE_REPOSITORY_URL,
      branch: process.env.CIRCLE_BRANCH,
      hash: process.env.CIRCLE_SHA1,
    });
  }
  const branch = await execa('git', ['rev-parse', '--abbrev-ref', 'HEAD']);
  const hash = await execa('git', ['rev-parse', 'HEAD']);
  return {
    time: Date.now(),
    branch: branch.stdout,
    hash: hash.stdout,
  };
};

export const getBuildNumber = (): number | undefined => {
  if (process.env.CIRCLE_BUILD_NUM) {
    return parseInt(process.env.CIRCLE_BUILD_NUM, 10);
  }
  return undefined;
};

export const getJobFolder = () => {
  const dir = path.resolve(process.cwd(), 'ci', 'jobs', job);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

export const getCiFolder = () => {
  const dir = path.resolve(process.cwd(), 'ci');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
};

export const writeJobStats = (startTime: number, workDir: string) => {
  const endTime = Date.now();
  const stats: JobInfo = {
    job,
    startTime,
    endTime,
    elapsed: endTime - startTime,
    buildNumber: getBuildNumber(),
  };
  const f = path.resolve(workDir, 'job.json');
  fs.writeFile(f, JSON.stringify(stats, null, 2), err => {
    if (err) {
      throw new Error('Unable to stats: ' + f);
    }
  });
};
