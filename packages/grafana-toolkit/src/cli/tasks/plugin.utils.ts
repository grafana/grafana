import { Task, TaskRunner } from './task';
import { execLine, getPluginVersion } from '../utils/execLine';
import { GitHubRelease } from '../utils/githubRelease';
// @ts-ignore
import execa = require('execa');

const releaseNotes = () => {
  return execLine(`awk \'BEGIN {FS="##"; RS=""} FNR==3 {print; exit}\' CHANGELOG.md'`);
};

const checkoutBranch = async (branchName: string, options: string): Promise<string> => {
  const currentBranch = await execLine(`git rev-parse --abbrev-ref HEAD`);
  const createBranch =
    (await execLine(`git branch -a | grep ${branchName} | grep -v remote`)) === branchName ? '' : '-b';
  if (currentBranch !== branchName) {
    return `git checkout ${createBranch} ${branchName}`;
  }
  return '';
};

export interface GithuPublishOptions {
  dryrun?: boolean;
  verbose?: boolean;
}

const githubPublishRunner: TaskRunner<GithuPublishOptions> = async ({ dryrun, verbose }) => {
  const pluginVersion = getPluginVersion();
  const options = dryrun ? '--dry-run' : '';
  const GIT_EMAIL = 'eng@grafana.com';
  const GIT_USERNAME = 'CircleCI Automation';
  const GITHUB_TOKEN = '';
  const gitRelease = new GitHubRelease(GITHUB_TOKEN, GIT_USERNAME, '', await releaseNotes());
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
      const output = await execLine(line);
      if (verbose) {
        console.log(output);
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
