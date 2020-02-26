import { Task, TaskRunner } from './task';
// import { pluginBuildRunner } from './plugin.build';
// import { restoreCwd } from '../utils/cwd';
// import { getPluginJson } from '../../config/utils/pluginValidation';
// import { getPluginId } from '../../config/utils/getPluginId';
// import { PluginMeta } from '@grafana/data';

// @ts-ignore
import execa = require('execa');
//import path = require('path');
// import fs from 'fs';
// import { getPackageDetails, findImagesInFolder, getGrafanaVersions, readGitLog } from '../../plugins/utils';
// import {
//   job,
//   getJobFolder,
//   writeJobStats,
//   getCiFolder,
//   getPluginBuildInfo,
//   getPullRequestNumber,
//   getCircleDownloadBaseURL,
// } from '../../plugins/env';
// import { agregateWorkflowInfo, agregateCoverageInfo, agregateTestInfo } from '../../plugins/workflow';
// import { PluginPackageDetails, PluginBuildReport, TestResultsInfo } from '../../plugins/types';
// import { runEndToEndTests } from '../../plugins/e2e/launcher';
// import { getEndToEndSettings } from '../../plugins/index';
// import { manifestTask } from './manifest';
// import { execTask } from '../utils/execTask';

export interface GithuPublishOptions {
  dryrun?: boolean;
}

const githubPublishRunner: TaskRunner<GithuPublishOptions> = async ({ dryrun }) => {
  console.log('hello world', dryrun);
};

export const githubPublishTask = new Task<GithuPublishOptions>('Github Publish', githubPublishRunner);
