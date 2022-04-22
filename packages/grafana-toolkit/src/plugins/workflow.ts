import fs from 'fs';
import path from 'path';

import { getBuildNumber, getCiFolder } from './env';
import { JobInfo, WorkflowInfo, CoverageInfo, TestResultsInfo } from './types';

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
      files.forEach((file) => {
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

export const agregateCoverageInfo = (): CoverageInfo[] => {
  const coverage: CoverageInfo[] = [];
  const ciDir = getCiFolder();
  const jobsFolder = path.resolve(ciDir, 'jobs');
  if (fs.existsSync(jobsFolder)) {
    const files = fs.readdirSync(jobsFolder);
    if (files && files.length) {
      files.forEach((file) => {
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

export const agregateTestInfo = (): TestResultsInfo[] => {
  const tests: TestResultsInfo[] = [];
  const ciDir = getCiFolder();
  const jobsFolder = path.resolve(ciDir, 'jobs');
  if (fs.existsSync(jobsFolder)) {
    const files = fs.readdirSync(jobsFolder);
    if (files && files.length) {
      files.forEach((file) => {
        if (file.startsWith('test')) {
          const summary = path.resolve(jobsFolder, file, 'results.json');
          if (fs.existsSync(summary)) {
            tests.push(require(summary) as TestResultsInfo);
          }
        }
      });
    } else {
      console.log('NO Jobs IN: ', jobsFolder);
    }
  }
  return tests;
};
