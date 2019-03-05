import execa from 'execa';
import { execTask } from '../utils/execTask';
import { changeCwdToGrafanaUiDist, changeCwdToGrafanaUi } from '../utils/cwd';
import semver from 'semver';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { useSpinner } from '../utils/useSpinner';
import { savePackage, buildTask } from './grafanaui.build';
import { TaskRunner, Task } from './task';

type VersionBumpType = 'prerelease' | 'patch' | 'minor' | 'major';

interface ReleaseTaskOptions {
  publishToNpm: boolean;
}

const promptBumpType = async () => {
  return inquirer.prompt<{ type: VersionBumpType }>([
    {
      type: 'list',
      message: 'Select version bump',
      name: 'type',
      choices: ['prerelease', 'patch', 'minor', 'major'],
      validate: answer => {
        if (answer.length < 1) {
          return 'You must choose something';
        }

        return true;
      },
    },
  ]);
};

const promptPrereleaseId = async (message = 'Is this a prerelease?', allowNo = true) => {
  return inquirer.prompt<{ id: string }>([
    {
      type: 'list',
      message: message,
      name: 'id',
      choices: allowNo ? ['no', 'alpha', 'beta'] : ['alpha', 'beta'],
      validate: answer => {
        if (answer.length < 1) {
          return 'You must choose something';
        }

        return true;
      },
    },
  ]);
};

const promptConfirm = async (message?: string) => {
  return inquirer.prompt<{ confirmed: boolean }>([
    {
      type: 'confirm',
      message: message || 'Is that correct?',
      name: 'confirmed',
      default: false,
    },
  ]);
};

const bumpVersion = (version: string) =>
  useSpinner<void>(`Saving version ${version} to package.json`, async () => {
    changeCwdToGrafanaUi();
    await execa('npm', ['version', version]);
    changeCwdToGrafanaUiDist();
    const pkg = require(`${process.cwd()}/package.json`);
    pkg.version = version;
    await savePackage({ path: `${process.cwd()}/package.json`, pkg });
  })();

const publishPackage = (name: string, version: string) =>
  useSpinner<void>(`Publishing ${name} @ ${version} to npm registry...`, async () => {
    changeCwdToGrafanaUiDist();
    console.log(chalk.yellowBright.bold(`\nReview dist package.json before proceeding!\n`));
    const { confirmed } = await promptConfirm('Are you ready to publish to npm?');

    if (!confirmed) {
      process.exit();
    }
    await execa('npm', ['publish', '--access', 'public']);
  })();

const releaseTaskRunner: TaskRunner<ReleaseTaskOptions> = async ({ publishToNpm }) => {
  await execTask(buildTask)();

  let releaseConfirmed = false;
  let nextVersion;
  changeCwdToGrafanaUiDist();

  const pkg = require(`${process.cwd()}/package.json`);

  console.log(`Current version: ${pkg.version}`);

  do {
    const { type } = await promptBumpType();
    console.log(type);
    if (type === 'prerelease') {
      const { id } = await promptPrereleaseId('What kind of prerelease?', false);
      nextVersion = semver.inc(pkg.version, type, id);
    } else {
      const { id } = await promptPrereleaseId();
      if (id !== 'no') {
        nextVersion = semver.inc(pkg.version, `pre${type}`, id);
      } else {
        nextVersion = semver.inc(pkg.version, type);
      }
    }

    console.log(chalk.yellowBright.bold(`You are going to release a new version of ${pkg.name}`));
    console.log(chalk.green(`Version bump: ${pkg.version} ->`), chalk.bold.yellowBright(`${nextVersion}`));
    const { confirmed } = await promptConfirm();

    releaseConfirmed = confirmed;
  } while (!releaseConfirmed);

  await bumpVersion(nextVersion);

  if (publishToNpm) {
    await publishPackage(pkg.name, nextVersion);
    console.log(chalk.green(`\nVersion ${nextVersion} of ${pkg.name} succesfully released!`));
    console.log(chalk.yellow(`\nUpdated @grafana/ui/package.json with version bump created - COMMIT THIS FILE!`));
    process.exit();
  } else {
    console.log(
      chalk.green(
        `\nVersion ${nextVersion} of ${pkg.name} succesfully prepared for release. See packages/grafana-ui/dist`
      )
    );
    console.log(chalk.green(`\nTo publish to npm registry run`), chalk.bold.blue(`npm run gui:publish`));
  }
};

export const releaseTask = new Task<ReleaseTaskOptions>();
releaseTask.setName('@grafana/ui release');
releaseTask.setRunner(releaseTaskRunner);
