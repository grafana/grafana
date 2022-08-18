import execa = require('execa');
import { readFileSync } from 'fs';
import path = require('path');

import { getPluginId } from '../../config/utils/getPluginId';
import { getPluginJson } from '../../config/utils/pluginValidation';
import { getCiFolder } from '../../plugins/env';
import { GitHubRelease } from '../utils/githubRelease';
import { useSpinner } from '../utils/useSpinner';

import { Task, TaskRunner } from './task';

interface Command extends Array<any> {}
const DEFAULT_EMAIL_ADDRESS = 'eng@grafana.com';
const DEFAULT_USERNAME = 'CircleCI Automation';

const releaseNotes = async (): Promise<string> => {
  const { stdout } = await execa(`awk 'BEGIN {FS="##"; RS="##"} FNR==3 {print "##" $1; exit}' CHANGELOG.md`, {
    shell: true,
  });
  return stdout;
};

const checkoutBranch = async (branchName: string): Promise<Command> => {
  const currentBranch = await execa(`git rev-parse --abbrev-ref HEAD`, { shell: true });
  const branchesAvailable = await execa(
    `(git branch -a | grep "${branchName}$" | grep -v remote) || echo 'No release found'`,
    { shell: true }
  );

  if (currentBranch.stdout !== branchName) {
    console.log('available', branchesAvailable.stdout.trim());
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

  throw `Could not find a suitable git repository. Received [${url}]`;
};

const prepareRelease = ({ dryrun, verbose }: any) =>
  useSpinner('Preparing release', async () => {
    const ciDir = getCiFolder();
    const distDir = path.resolve(ciDir, 'dist');
    const distContentDir = path.resolve(distDir, getPluginId());
    const pluginJsonFile = path.resolve(distContentDir, 'plugin.json');
    const pluginJson = getPluginJson(pluginJsonFile);

    const githubPublishScript: Command = [
      ['git', ['config', 'user.email', DEFAULT_EMAIL_ADDRESS]],
      ['git', ['config', 'user.name', DEFAULT_USERNAME]],
      await checkoutBranch(`release-${pluginJson.info.version}`),
      ['/bin/rm', ['-rf', 'dist'], { dryrun }],
      ['mv', ['-v', distContentDir, 'dist']],
      ['git', ['add', '--force', 'dist'], { dryrun }],
      ['/bin/rm', ['-rf', 'src'], { enterprise: true }],
      ['git', ['rm', '-rf', 'src'], { enterprise: true }],
      [
        'git',
        ['commit', '-m', `automated release ${pluginJson.info.version} [skip ci]`],
        {
          dryrun,
          okOnError: [/nothing to commit/g, /nothing added to commit/g, /no changes added to commit/g],
        },
      ],
      ['git', ['push', '-f', 'origin', `release-${pluginJson.info.version}`], { dryrun }],
      ['git', ['tag', '-f', `v${pluginJson.info.version}`]],
      ['git', ['push', '-f', 'origin', `v${pluginJson.info.version}`]],
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

          // Exit if the plugin is NOT an enterprise plugin
          if (pluginJson.enterprise && !opts['enterprise']) {
            continue;
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
      } catch (ex: any) {
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

export const getToolkitVersion = () => {
  const pkg = readFileSync(`${__dirname}/../../../package.json`, 'utf8');
  const { version } = JSON.parse(pkg);
  if (!version) {
    throw `Could not find the toolkit version`;
  }
  return version;
};
interface GithubPublishReleaseOptions {
  commitHash?: string;
  githubToken: string;
  githubUser: string;
  gitRepoName: string;
}

const createRelease = ({ commitHash, githubUser, githubToken, gitRepoName }: GithubPublishReleaseOptions) =>
  useSpinner('Creating release', async () => {
    const gitRelease = new GitHubRelease(githubToken, githubUser, gitRepoName, await releaseNotes(), commitHash);
    return gitRelease.release();
  });

export interface GithubPublishOptions {
  dryrun?: boolean;
  verbose?: boolean;
  commitHash?: string;
  dev?: boolean;
}

const githubPublishRunner: TaskRunner<GithubPublishOptions> = async ({ dryrun, verbose, commitHash }) => {
  let repoUrl: string | undefined = process.env.DRONE_REPO_LINK || process.env.CIRCLE_REPOSITORY_URL;
  if (!repoUrl) {
    // Try and figure it out
    const repo = await execa('git', ['config', '--local', 'remote.origin.url']);
    if (repo && repo.stdout) {
      repoUrl = repo.stdout;
    } else {
      throw new Error(
        'The release plugin requires you specify the repository url as environment variable DRONE_REPO_LINK or ' +
          'CIRCLE_REPOSITORY_URL'
      );
    }
  }

  if (!process.env['GITHUB_ACCESS_TOKEN']) {
    // Try to use GITHUB_TOKEN, which may be set.
    if (process.env['GITHUB_TOKEN']) {
      process.env['GITHUB_ACCESS_TOKEN'] = process.env['GITHUB_TOKEN'];
    } else {
      throw new Error(
        `GitHub publish requires that you set the environment variable GITHUB_ACCESS_TOKEN to a valid github api token.
        See: https://github.com/settings/tokens for more details.`
      );
    }
  }

  if (!process.env['GITHUB_USERNAME']) {
    // We can default this one
    process.env['GITHUB_USERNAME'] = DEFAULT_EMAIL_ADDRESS;
  }

  const parsedUrl = gitUrlParse(repoUrl);
  const githubToken = process.env['GITHUB_ACCESS_TOKEN'];
  const githubUser = parsedUrl.owner;

  await prepareRelease({
    dryrun,
    verbose,
  });

  await createRelease({
    commitHash,
    githubUser,
    githubToken,
    gitRepoName: parsedUrl.name,
  });
};

export const githubPublishTask = new Task<GithubPublishOptions>('GitHub Publish', githubPublishRunner);
