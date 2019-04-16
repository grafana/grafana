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
  usePackageJsonVersion: boolean;
  createVersionCommit: boolean;
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

// Since Grafana core depends on @grafana/ui highly, we run full check before release
const runChecksAndTests = async () =>
  useSpinner<void>(`Running checks and tests`, async () => {
    await execa('npm', ['run', 'test']);
  })();

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

const ensureMasterBranch = async () => {
  const currentBranch = await execa.stdout('git', ['symbolic-ref', '--short', 'HEAD']);
  const status = await execa.stdout('git', ['status', '--porcelain']);

  if (currentBranch !== 'master' && status !== '') {
    console.error(chalk.red.bold('You need to be on clean master branch to release @grafana/ui'));
    process.exit(1);
  }
};

const prepareVersionCommitAndPush = async (version: string) =>
  useSpinner<void>('Commiting and pushing @grafana/ui version update', async () => {
    await execa.stdout('git', ['commit', '-a', '-m', `Upgrade @grafana/ui version to v${version}`]);
    await execa.stdout('git', ['push']);
  })();

const releaseTaskRunner: TaskRunner<ReleaseTaskOptions> = async ({
  publishToNpm,
  usePackageJsonVersion,
  createVersionCommit,
}) => {
  await runChecksAndTests();
  if (publishToNpm) {
    // TODO: Ensure release branch
    // When need to update this when we star keeping @grafana/ui releases in sync with core
    await ensureMasterBranch();
  }

  await execTask(buildTask)();

  let releaseConfirmed = false;
  let nextVersion;
  changeCwdToGrafanaUiDist();

  const pkg = require(`${process.cwd()}/package.json`);

  console.log(`Current version: ${pkg.version}`);

  do {
    if (!usePackageJsonVersion) {
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
    } else {
      nextVersion = pkg.version;
    }

    console.log(chalk.yellowBright.bold(`You are going to release a new version of ${pkg.name}`));

    if (usePackageJsonVersion) {
      console.log(chalk.green(`Version based on package.json: `), chalk.bold.yellowBright(`${nextVersion}`));
    } else {
      console.log(chalk.green(`Version bump: ${pkg.version} ->`), chalk.bold.yellowBright(`${nextVersion}`));
    }

    const { confirmed } = await promptConfirm();

    releaseConfirmed = confirmed;
  } while (!releaseConfirmed);

  if (!usePackageJsonVersion) {
    await bumpVersion(nextVersion);
  }

  if (createVersionCommit) {
    await prepareVersionCommitAndPush(nextVersion);
  }

  if (publishToNpm) {
    await publishPackage(pkg.name, nextVersion);
    console.log(chalk.green(`\nVersion ${nextVersion} of ${pkg.name} succesfully released!`));
    console.log(chalk.yellow(`\nUpdated @grafana/ui/package.json with version bump created.`));

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
