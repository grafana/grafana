import { Task, TaskRunner } from './task';
import { getPluginJson } from '../../config/utils/pluginValidation';
import { GitHubRelease } from '../utils/githubRelease';
import path = require('path');

// @ts-ignore
import execa = require('execa');

const releaseNotes = async (): Promise<string> => {
  const { stdout } = await execa.shell(`awk \'BEGIN {FS="##"; RS=""} FNR==3 {print; exit}\' CHANGELOG.md`);
  return stdout;
};

const checkoutBranch = async (branchName: string, options: string): Promise<string> => {
  const currentBranch = await execa.shell(`git rev-parse --abbrev-ref HEAD`);
  const branchesAvailable = await execa.shell(`git branch -a | grep ${branchName} | grep -v remote 
    || echo 'No release found'`);
  const createBranch = branchesAvailable.stdout === branchName ? '' : '-b';
  if (currentBranch.stdout !== branchName) {
    return `git checkout ${createBranch} ${branchName}`;
  }
  return '';
};

export interface GithuPublishOptions {
  dryrun?: boolean;
  verbose?: boolean;
}

const githubPublishRunner: TaskRunner<GithuPublishOptions> = async ({ dryrun, verbose }) => {
  const distDir = path.resolve(process.cwd(), 'dist');
  const pluginVersion = getPluginJson(path.resolve(distDir, 'plugin.json')).info.version;
  const options = dryrun ? '--dry-run' : '';
  const GIT_EMAIL = 'eng@grafana.com';
  const GIT_USERNAME = 'CircleCI Automation';
  let githubToken = '';
  if (process.env['GITHUB_TOKEN']) {
    githubToken = process.env['GITHUB_TOKEN'];
  } else {
    throw `Github publish requires that you set the environment variable GITHUB_TOKEN to a valid github api token.
    See: https://github.com/settings/tokens for more details.`;
  }
  const gitRelease = new GitHubRelease(githubToken, GIT_USERNAME, '', await releaseNotes());
  const githubPublishScript: string[] = [
    `git config user.email ${GIT_EMAIL}`,
    `git config user.name "${GIT_USERNAME}"`,
    await checkoutBranch(`release-${pluginVersion}`, options),
    'git add --force dist/',
    `git commit -m "automated release ${pluginVersion} [skip ci]" ${options}`,
    `git push -f origin release-${pluginVersion} ${options}`,
    `git tag -f ${pluginVersion}`,
    `git push -f origin release-${pluginVersion} ${options}`,
  ];

  gitRelease.release();

  githubPublishScript.forEach(async line => {
    try {
      if (verbose) {
        console.log('executing >>', line);
      }
      const { stdout } = await execa.shell(line);
      if (verbose) {
        console.log(stdout);
      } else {
        process.stdout.write('.');
      }
    } catch (ex) {
      console.error(ex.message);
      process.exit(-1);
    }
  });

  if (verbose) {
    process.stdout.write('\n');
  }
};

export const githubPublishTask = new Task<GithuPublishOptions>('Github Publish', githubPublishRunner);
