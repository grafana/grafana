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

export const job =
  (process.env.DRONE_STEP_NAME ? process.env.DRONE_STEP_NAME : process.env.CIRCLE_JOB) || getJobFromProcessArgv();

export const getPluginBuildInfo = async (): Promise<PluginBuildInfo> => {
  if (process.env.CI === 'true') {
    let repo: string | undefined;
    let branch: string | undefined;
    let hash: string | undefined;
    let build: number | undefined;
    let pr: number | undefined;
    if (process.env.DRONE === 'true') {
      repo = process.env.DRONE_REPO_LINK;
      branch = process.env.DRONE_BRANCH;
      hash = process.env.DRONE_COMMIT_SHA;
      build = parseInt(process.env.DRONE_BUILD_NUMBER || '', 10);
      pr = parseInt(process.env.DRONE_PULL_REQUEST || '', 10);
    } else if (process.env.CIRCLECI === 'true') {
      repo = process.env.CIRCLE_REPOSITORY_URL;
      branch = process.env.CIRCLE_BRANCH;
      hash = process.env.CIRCLE_SHA1;
      build = parseInt(process.env.CIRCLE_BUILD_NUM || '', 10);
      const url = process.env.CIRCLE_PULL_REQUEST || '';
      const idx = url.lastIndexOf('/') + 1;
      pr = parseInt(url.substring(idx), 10);
    }

    const info: PluginBuildInfo = {
      time: Date.now(),
      repo,
      branch,
      hash,
    };
    if (pr) {
      info.pr = pr;
    }
    if (build) {
      info.number = build;
    }
    return info;
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
  if (process.env.DRONE === 'true') {
    return parseInt(process.env.DRONE_BUILD_NUMBER || '', 10);
  } else if (process.env.CIRCLECI === 'true') {
    return parseInt(process.env.CIRCLE_BUILD_NUM || '', 10);
  }

  return undefined;
};

export const getPullRequestNumber = (): number | undefined => {
  if (process.env.DRONE === 'true') {
    return parseInt(process.env.DRONE_PULL_REQUEST || '', 10);
  } else if (process.env.CIRCLECI === 'true') {
    const url = process.env.CIRCLE_PULL_REQUEST || '';
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

// https://circleci.com/api/v1.1/project/github/NatelEnergy/grafana-discrete-panel/latest/artifacts
export async function getCircleDownloadBaseURL(): Promise<string | undefined> {
  try {
    const axios = require('axios');
    const repo = process.env.CIRCLE_PROJECT_REPONAME;
    const user = process.env.CIRCLE_PROJECT_USERNAME;
    let url = `https://circleci.com/api/v1.1/project/github/${user}/${repo}/latest/artifacts`;
    const rsp = await axios.get(url);
    for (const s of rsp.data) {
      const { path, url } = s;
      if (url && path && path.endsWith('report.json')) {
        return url.substring(url.length - 'report.json'.length);
      }
    }
  } catch (e) {
    console.log('Error reading CircleCI artifact URL', e);
  }
  return undefined;
}
