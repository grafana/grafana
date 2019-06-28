// @ts-ignore
import program from 'commander';
import { execTask } from './utils/execTask';
import chalk from 'chalk';
import { startTask } from './tasks/core.start';
import { buildTask } from './tasks/grafanaui.build';
import { releaseTask } from './tasks/grafanaui.release';
import { changelogTask } from './tasks/changelog';
import { cherryPickTask } from './tasks/cherrypick';
import { precommitTask } from './tasks/precommit';
import { templateTask } from './tasks/template';
import { pluginBuildTask } from './tasks/plugin.build';
import { toolkitBuildTask } from './tasks/toolkit.build';
import { pluginTestTask } from './tasks/plugin.tests';
import { searchTestDataSetupTask } from './tasks/searchTestDataSetup';
import { closeMilestoneTask } from './tasks/closeMilestone';
import { pluginDevTask } from './tasks/plugin.dev';

export const run = (includeInternalScripts = false) => {
  if (includeInternalScripts) {
    program.option('-d, --depreciate <scripts>', 'Inform about npm script deprecation', v => v.split(','));
    program
      .command('core:start')
      .option('-h, --hot', 'Run front-end with HRM enabled')
      .option('-t, --watchTheme', 'Watch for theme changes and regenerate variables.scss files')
      .description('Starts Grafana front-end in development mode with watch enabled')
      .action(async cmd => {
        await execTask(startTask)({
          watchThemes: cmd.watchTheme,
          hot: cmd.hot,
        });
      });

    program
      .command('gui:build')
      .description('Builds @grafana/ui package to packages/grafana-ui/dist')
      .action(async cmd => {
        // @ts-ignore
        await execTask(buildTask)();
      });

    program
      .command('gui:release')
      .description('Prepares @grafana/ui release (and publishes to npm on demand)')
      .option('-p, --publish', 'Publish @grafana/ui to npm registry')
      .option('-u, --usePackageJsonVersion', 'Use version specified in package.json')
      .option('--createVersionCommit', 'Create and push version commit')
      .action(async cmd => {
        await execTask(releaseTask)({
          publishToNpm: !!cmd.publish,
          usePackageJsonVersion: !!cmd.usePackageJsonVersion,
          createVersionCommit: !!cmd.createVersionCommit,
        });
      });

    program
      .command('changelog')
      .option('-m, --milestone <milestone>', 'Specify milestone')
      .description('Builds changelog markdown')
      .action(async cmd => {
        if (!cmd.milestone) {
          console.log('Please specify milestone, example: -m <milestone id from github milestone URL>');
          return;
        }

        await execTask(changelogTask)({
          milestone: cmd.milestone,
        });
      });

    program
      .command('cherrypick')
      .description('Helps find commits to cherry pick')
      .action(async cmd => {
        await execTask(cherryPickTask)({});
      });

    program
      .command('precommit')
      .description('Executes checks')
      .action(async cmd => {
        await execTask(precommitTask)({});
      });

    program
      .command('debug:template')
      .description('Just testing')
      .action(async cmd => {
        await execTask(templateTask)({});
      });

    program
      .command('toolkit:build')
      .description('Prepares grafana/toolkit dist package')
      .action(async cmd => {
        // @ts-ignore
        await execTask(toolkitBuildTask)();
      });

    program
      .command('searchTestData')
      .option('-c, --count <number_of_dashboards>', 'Specify number of dashboards')
      .description('Setup test data for search')
      .action(async cmd => {
        await execTask(searchTestDataSetupTask)({ count: cmd.count });
      });

    program
      .command('close-milestone')
      .option('-m, --milestone <milestone>', 'Specify milestone')
      .description('Helps ends a milestone by removing the cherry-pick label and closing it')
      .action(async cmd => {
        if (!cmd.milestone) {
          console.log('Please specify milestone, example: -m <milestone id from github milestone URL>');
          return;
        }

        await execTask(closeMilestoneTask)({
          milestone: cmd.milestone,
        });
      });
  }

  program
    .command('plugin:build')
    .description('Prepares plugin dist package')
    .action(async cmd => {
      await execTask(pluginBuildTask)({});
    });

  program
    .command('plugin:dev')
    .description('Starts plugin dev mode')
    .action(async cmd => {
      await execTask(pluginDevTask)({
        watch: true,
      });
    });

  program
    .command('plugin:test')
    .option('-u, --updateSnapshot', 'Run snapshots update')
    .option('--coverage', 'Run code coverage')
    .description('Executes plugin tests')
    .action(async cmd => {
      await execTask(pluginTestTask)({
        updateSnapshot: !!cmd.updateSnapshot,
        coverage: !!cmd.coverage,
      });
    });

  program.on('command:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
  });

  program.parse(process.argv);

  if (program.depreciate && program.depreciate.length === 2) {
    console.log(
      chalk.yellow.bold(
        `[NPM script depreciation] ${program.depreciate[0]} is deprecated! Use ${program.depreciate[1]} instead!`
      )
    );
  }
};
