import execa from 'execa';
import { Task } from '..';
import { execTask } from '../utils/execTask';
import { changeCwdToGrafanaUiDist, changeCwdToGrafanaUi } from '../utils/cwd';
import semver from 'semver';
import inquirer from 'inquirer';
import chalk from 'chalk';
import { startSpinner } from '../utils/startSpinner';
import { savePackage } from './grafanaui.build';

type VersionBumpType = 'patch' | 'minor' | 'major';

const promptBumpType = async () => {
  return inquirer.prompt<{ type: VersionBumpType }>([
    {
      type: 'list',
      message: 'Select version bump',
      name: 'type',
      choices: ['patch', 'minor', 'major'],
      validate: answer => {
        if (answer.length < 1) {
          return 'You must choose something';
        }

        return true;
      },
    },
  ]);
};

const promptPrereleaseId = async () => {
  return inquirer.prompt<{ id: string }>([
    {
      type: 'list',
      message: 'Is this a prerelease?',
      name: 'id',
      choices: ['no', 'alpha', 'beta'],
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

const bumpVersion = async (version: string) => {
  const spinner = startSpinner(`Saving version ${version} to package.json`);
  changeCwdToGrafanaUi();

  try {
    await execa('npm', ['version', version]);
    spinner.succeed();
  } catch (e) {
    console.log(e);
    spinner.fail();
  }

  changeCwdToGrafanaUiDist();
  const pkg = require(`${process.cwd()}/package.json`);
  pkg.version = version;
  await savePackage(`${process.cwd()}/package.json`, pkg);
};

const publishPackage = async (name: string, version: string) => {
  changeCwdToGrafanaUiDist();
  console.log(chalk.yellowBright.bold(`\nReview dist package.json before proceeding!\n`));
  const { confirmed } = await promptConfirm('Are you ready to publish to npm?');

  if (!confirmed) {
    process.exit();
  }

  const spinner = startSpinner(`Publishing ${name} @ ${version} to npm registry...`);

  try {
    await execa('npm', ['publish', '--access', 'public']);
    spinner.succeed();
  } catch (e) {
    console.log(e);
    spinner.fail();
    process.exit(1);
  }
};

const releaseTask: Task<void> = async () => {
  await execTask('grafanaui.build');
  let releaseConfirmed = false;
  let nextVersion;
  changeCwdToGrafanaUiDist();

  const pkg = require(`${process.cwd()}/package.json`);

  console.log(`Current version: ${pkg.version}`);

  do {
    const { type } = await promptBumpType();
    const { id } = await promptPrereleaseId();

    if (id !== 'no') {
      nextVersion = semver.inc(pkg.version, `pre${type}`, id);
    } else {
      nextVersion = semver.inc(pkg.version, type);
    }

    console.log(chalk.yellowBright.bold(`You are going to release a new version of ${pkg.name}`));
    console.log(chalk.green(`Version bump: ${pkg.version} ->`), chalk.bold.yellowBright(`${nextVersion}`));
    const { confirmed } = await promptConfirm();

    releaseConfirmed = confirmed;
  } while (!releaseConfirmed);

  await bumpVersion(nextVersion);
  await publishPackage(pkg.name, nextVersion);

  console.log(chalk.green(`\nVersion ${nextVersion} of ${pkg.name} succesfully released!`));
  console.log(chalk.yellow(`\nUpdated @grafana/ui/package.json with version bump created - COMMIT THIS FILE!`));
};

export default releaseTask;
