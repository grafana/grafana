import execa from 'execa';
import path from 'path';
import fs from 'fs';
import { PluginBuildInfo } from '@grafana/data';
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
    const info: PluginBuildInfo = {
      time: Date.now(),
      repo: process.env.CIRCLE_REPOSITORY_URL,
      branch: process.env.CIRCLE_BRANCH,
      hash: process.env.CIRCLE_SHA1,
    };
    const pr = getPullRequestNumber();
    const build = getBuildNumber();
    if (pr) {
      info.pr = pr;
    }
    if (build) {
      info.number = build;
    }
    return Promise.resolve(info);
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

export const getPullRequestNumber = (): number | undefined => {
  if (process.env.CIRCLE_PULL_REQUEST) {
    const url = process.env.CIRCLE_PULL_REQUEST;
    const idx = url.lastIndexOf('/') + 1;
    return parseInt(url.substring(idx), 10);
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

export async function getCircleDownloadBaseURL(): Promise<string | undefined> {
  try {
    const axios = require('axios');
    const buildNumber = getBuildNumber();
    const repo = process.env.CIRCLE_PROJECT_REPONAME;
    const user = process.env.CIRCLE_PROJECT_USERNAME;
    let url = `https://circleci.com/api/v1.1/project/github/${user}/${repo}/latest/artifacts`;
    const rsp = await axios.get(url);
    for (const s of rsp.data) {
      let idx = s.url.indexOf('-');
      if (idx > 0) {
        url = s.url.substring(idx);
        idx = url.indexOf('circleci/plugin/ci');
        if (idx > 0) {
          url = url.substring(0, idx);
          url = `https://${buildNumber}${url}circleci/plugin/ci`;
          return url;
        }
      }
    }
  } catch {}
  return undefined;
}
