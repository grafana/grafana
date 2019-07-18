import execa = require('execa');
import path = require('path');
import fs = require('fs');

export interface PluginSourceInfo {
  time?: number;
  repo?: string;
  branch?: string;
  hash?: string;
}

export interface JobInfo {
  job?: string;
  startTime: number;
  endTime: number;
  elapsed: number;
  status?: string;
  buildNumber?: number;
}

export interface WorkflowInfo extends JobInfo {
  workflowId?: string;
  jobs: JobInfo[];
  user?: string;
  repo?: string;
}

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

export const getPluginSourceInfo = async (): Promise<PluginSourceInfo> => {
  if (process.env.CIRCLE_SHA1) {
    return Promise.resolve({
      time: Date.now(),
      repo: process.env.CIRCLE_REPOSITORY_URL,
      branch: process.env.CIRCLE_BRANCH,
      hash: process.env.CIRCLE_SHA1,
    });
  }
  const exe = await execa('git', ['rev-parse', 'HEAD']);
  return {
    time: Date.now(),
    hash: exe.stdout,
  };
};

const getBuildNumber = (): number | undefined => {
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

export const agregateWorkflowInfo = (): WorkflowInfo => {
  const now = Date.now();
  const workflow: WorkflowInfo = {
    jobs: [],
    startTime: now,
    endTime: now,
    workflowId: process.env.CIRCLE_WORKFLOW_ID,
    repo: process.env.CIRCLE_PROJECT_REPONAME,
    user: process.env.CIRCLE_PROJECT_USERNAME,
    buildNumber: getBuildNumber(),
    elapsed: 0,
  };

  const jobsFolder = path.resolve(getCiFolder(), 'jobs');
  if (fs.existsSync(jobsFolder)) {
    const files = fs.readdirSync(jobsFolder);
    if (files && files.length) {
      files.forEach(file => {
        const p = path.resolve(jobsFolder, file, 'job.json');
        if (fs.existsSync(p)) {
          const job = require(p) as JobInfo;
          workflow.jobs.push(job);
          if (job.startTime < workflow.startTime) {
            workflow.startTime = job.startTime;
          }
          if (job.endTime > workflow.endTime) {
            workflow.endTime = job.endTime;
          }
        } else {
          console.log('Missing Job info: ', p);
        }
      });
    } else {
      console.log('NO JOBS IN: ', jobsFolder);
    }
  }

  workflow.elapsed = workflow.endTime - workflow.startTime;
  return workflow;
};

export interface CoverageDetails {
  total: number;
  covered: number;
  skipped: number;
  pct: number;
}

export interface CoverageInfo {
  job: string;
  summary: { [key: string]: CoverageDetails };
  report?: string; // path to report
}

export const agregateCoverageInfo = (): CoverageInfo[] => {
  const coverage: CoverageInfo[] = [];
  const ciDir = getCiFolder();
  const jobsFolder = path.resolve(ciDir, 'jobs');
  if (fs.existsSync(jobsFolder)) {
    const files = fs.readdirSync(jobsFolder);
    if (files && files.length) {
      files.forEach(file => {
        const dir = path.resolve(jobsFolder, file, 'coverage');
        if (fs.existsSync(dir)) {
          const s = path.resolve(dir, 'coverage-summary.json');
          const r = path.resolve(dir, 'lcov-report', 'index.html');
          if (fs.existsSync(s)) {
            const raw = require(s);
            const info: CoverageInfo = {
              job: file,
              summary: raw.total,
            };
            if (fs.existsSync(r)) {
              info.report = r.substring(ciDir.length);
            }
            coverage.push(info);
          }
        }
      });
    } else {
      console.log('NO JOBS IN: ', jobsFolder);
    }
  }
  return coverage;
};

export interface TestResultInfo {
  job: string;
  grafana?: any;
  status?: string;
  error?: string;
}

export const agregateTestInfo = (): TestResultInfo[] => {
  const tests: TestResultInfo[] = [];
  const ciDir = getCiFolder();
  const jobsFolder = path.resolve(ciDir, 'jobs');
  if (fs.existsSync(jobsFolder)) {
    const files = fs.readdirSync(jobsFolder);
    if (files && files.length) {
      files.forEach(file => {
        if (file.startsWith('test')) {
          const summary = path.resolve(jobsFolder, file, 'results.json');
          if (fs.existsSync(summary)) {
            tests.push(require(summary) as TestResultInfo);
          }
        }
      });
    } else {
      console.log('NO Jobs IN: ', jobsFolder);
    }
  }
  return tests;
};
