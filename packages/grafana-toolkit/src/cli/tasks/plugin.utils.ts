import { Task, TaskRunner } from './task';
import { getPluginJson } from '../../config/utils/pluginValidation';
import { GitHubRelease } from '../utils/githubRelease';
import { getPluginId } from '../../config/utils/getPluginId';
import { getCiFolder } from '../../plugins/env';
import { useSpinner } from '../utils/useSpinner';

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

const gitUrlParse = (url: string): { owner: string; name: string } => {
  let matchResult: RegExpMatchArray | null = [];

  if (url.match(/^git@github.com/)) {
    // We have an ssh style url.
    matchResult = url.match(/^git@github.com:(.*?)\/(.*?)\.git/);
  }

  if (url.match(/^https:\/\/github.com\//)) {
    // We have an https style url
    matchResult = url.match(/^https:\/\/github.com\/(.*?)\/(.*?)\/.git/);
  }

  if (matchResult && matchResult.length > 2) {
    return {
      owner: matchResult[1],
      name: matchResult[2],
    };
  }

  throw `Coult not find a suitable git repository. Received [${url}]`;
};

const prepareRelease = useSpinner<any>('Preparing release', async ({ dryrun, verbose }) => {
  const ciDir = getCiFolder();
  const distDir = path.resolve(ciDir, 'dist');
  const distContentDir = path.resolve(distDir, getPluginId());
  const pluginJsonFile = path.resolve(distContentDir, 'plugin.json');
  const pluginVersion = getPluginJson(pluginJsonFile).info.version;
  const GIT_EMAIL = 'eng@grafana.com';
  const GIT_USERNAME = 'CircleCI Automation';

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
});

interface GithubPluglishReleaseOptions {
  commitHash?: string;
  recreate?: boolean;
  githubToken: string;
  gitRepoOwner: string;
  gitRepoName: string;
}

const createRelease = useSpinner<GithubPluglishReleaseOptions>(
  'Creating release',
  async ({ commitHash, recreate, githubToken, gitRepoName, gitRepoOwner }) => {
    const gitRelease = new GitHubRelease(githubToken, gitRepoOwner, gitRepoName, await releaseNotes(), commitHash);
    return gitRelease.release(recreate || false);
  }
);

export interface GithubPublishOptions {
  dryrun?: boolean;
  verbose?: boolean;
  commitHash?: string;
  recreate?: boolean;
}

const githubPublishRunner: TaskRunner<GithubPublishOptions> = async ({ dryrun, verbose, commitHash, recreate }) => {
  if (!process.env['CIRCLE_REPOSITORY_URL']) {
    throw `The release plugin requires you specify the repository url as environment variable CIRCLE_REPOSITORY_URL`;
  }

  if (!process.env['GITHUB_TOKEN']) {
    throw `Github publish requires that you set the environment variable GITHUB_TOKEN to a valid github api token.
    See: https://github.com/settings/tokens for more details.`;
  }

  const parsedUrl = gitUrlParse(process.env['CIRCLE_REPOSITORY_URL']);
  const githubToken = process.env['GITHUB_TOKEN'];

  await prepareRelease({
    dryrun,
    verbose,
  });

  await createRelease({
    commitHash,
    recreate,
    githubToken,
    gitRepoOwner: parsedUrl.owner,
    gitRepoName: parsedUrl.name,
  });
};

export const githubPublishTask = new Task<GithubPublishOptions>('Github Publish', githubPublishRunner);
