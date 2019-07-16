import path = require('path');
import fs = require('fs');

export interface JobInfo {
  job?: string;
  startTime: number;
  endTime: number;
  elapsed: number;
  status?: string;
  buildNumber?: string;
}

export interface WorkflowInfo extends JobInfo {
  workflowId?: string;
  jobs: JobInfo[];
  branch?: string;
  repo?: string;
  sha1?: string;
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
    buildNumber: process.env.CIRCLE_BUILD_NUM,
  };
  const f = path.resolve(workDir, 'job.json');
  fs.writeFile(f, JSON.stringify(stats, null, 2), err => {
    if (err) {
      throw new Error('Unable to stats: ' + f);
    }
  });
};

export const agregateWorkflowInfo = (): any => {
  const now = Date.now();
  const workflow: WorkflowInfo = {
    jobs: [],
    startTime: now,
    endTime: now,
    workflowId: process.env.CIRCLE_WORKFLOW_ID,
    branch: process.env.CIRCLE_BRANCH,
    repo: process.env.CIRCLE_REPOSITORY_URL,
    sha1: process.env.CIRCLE_SHA1,
    buildNumber: process.env.CIRCLE_BUILD_NUM,
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
