import { Task, TaskRunner } from './task';
import { getPluginJson } from '../../config/utils/pluginValidation';
import { GitHubRelease } from '../utils/githubRelease';
import { getPluginId } from '../../config/utils/getPluginId';
import { getCiFolder } from '../../plugins/env';
import parseGitConfig = require('parse-git-config');
import gitUrlParse = require('git-url-parse');

import path = require('path');

// @ts-ignore
import execa = require('execa');

interface Command extends Array<any> {}

const releaseNotes = async (): Promise<string> => {
  const { stdout } = await execa.shell(`awk \'BEGIN {FS="##"; RS=""} FNR==3 {print; exit}\' CHANGELOG.md`);
  return stdout;
};

const checkoutBranch = async (branchName: string): Promise<Command> => {
  const currentBranch = await execa.shell(`git rev-parse --abbrev-ref HEAD`);
  const branchesAvailable = await execa.shell(
    `(git branch -a | grep ${branchName} | grep -v remote) || echo 'No release found'`
  );

  if (currentBranch.stdout !== branchName) {
    if (branchesAvailable.stdout.trim() === branchName) {
      return ['git', ['checkout', branchName]];
    } else {
      return ['git', ['checkout', '-b', branchName]];
    }
  }
  return [];
};

export interface GithuPublishOptions {
  dryrun?: boolean;
  verbose?: boolean;
  commitHash?: string;
  recreate?: boolean;
}

const githubPublishRunner: TaskRunner<GithuPublishOptions> = async ({ dryrun, verbose, commitHash, recreate }) => {
  const gitConfig = parseGitConfig.sync();
  const parsedUrl = gitUrlParse(parseGitConfig.expandKeys(gitConfig).remote.origin.url);
  const ciDir = getCiFolder();
  const distDir = path.resolve(ciDir, 'dist');
  const distContentDir = path.resolve(distDir, getPluginId());
  const pluginJsonFile = path.resolve(distContentDir, 'plugin.json');
  const pluginVersion = getPluginJson(pluginJsonFile).info.version;
  const GIT_EMAIL = 'eng@grafana.com';
  const GIT_USERNAME = 'CircleCI Automation';
  let githubToken = '';
  if (process.env['GITHUB_TOKEN']) {
    githubToken = process.env['GITHUB_TOKEN'];
  } else {
    throw `Github publish requires that you set the environment variable GITHUB_TOKEN to a valid github api token.
    See: https://github.com/settings/tokens for more details.`;
  }
  const githubPublishScript: Command = [
    ['git', ['config', 'user.email', GIT_EMAIL]],
    ['git', ['config', 'user.name', GIT_USERNAME]],
    await checkoutBranch(`release-${pluginVersion}`),
    ['git', ['add', '--force', distDir], { dryrun }],
    [
      'git',
      ['commit', '-m', `automated release ${pluginVersion} [skip ci]`],
      {
        dryrun,
        okOnError: [/nothing to commit/g, /nothing added to commit/g, /no changes added to commit/g],
      },
    ],
    ['git', ['tag', '-f', pluginVersion]],
    ['git', ['push', '-f', 'origin', `release-${pluginVersion}`], { dryrun }],
  ];

  for (let line of githubPublishScript) {
    const opts = line.length === 3 ? line[2] : {};
    const command = line[0];
    const args = line[1];

    try {
      if (verbose) {
        console.log('executing >>', line);
      }

      if (line.length > 0 && line[0].length > 0) {
        if (opts['dryrun']) {
          line[1].push('--dry-run');
        }
        const { stdout } = await execa(command, args);
        if (verbose) {
          console.log(stdout);
        } else {
          process.stdout.write('.');
        }
      } else {
        if (verbose) {
          console.log('skipping empty line');
        }
      }
    } catch (ex) {
      const err: string = ex.message;
      if (opts['okOnError'] && Array.isArray(opts['okOnError'])) {
        let trueError = true;
        for (let regex of opts['okOnError']) {
          if (err.match(regex)) {
            trueError = false;
            break;
          }
        }

        if (!trueError) {
          // This is not an error
          continue;
        }
      }
      console.error(err);
      process.exit(-1);
    }
  }

  console.log('Running github release');
  const gitRelease = new GitHubRelease(
    githubToken,
    parsedUrl.owner,
    parsedUrl.name,
    await releaseNotes(),
    commitHash,
    recreate
  );
  await gitRelease.release();

  if (verbose) {
    process.stdout.write('\n');
  }
};

export const githubPublishTask = new Task<GithuPublishOptions>('Github Publish', githubPublishRunner);
