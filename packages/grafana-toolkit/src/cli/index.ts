// @ts-ignore
import program from 'commander';
import { execTask } from './utils/execTask';
import chalk from 'chalk';
import { startTask } from './tasks/core.start';
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
import { githubPublishTask } from './tasks/plugin.utils';
import { pluginUpdateTask } from './tasks/plugin.update';
import { ciBuildPluginDocsTask, ciBuildPluginTask, ciPackagePluginTask, ciPluginReportTask } from './tasks/plugin.ci';
import { buildPackageTask } from './tasks/package.build';
import { pluginCreateTask } from './tasks/plugin.create';
import { bundleManagedTask } from './tasks/plugin/bundle.managed';
import { componentCreateTask } from './tasks/component.create';

export const run = (includeInternalScripts = false) => {
  if (includeInternalScripts) {
    program.option('-d, --depreciate <scripts>', 'Inform about npm script deprecation', v => v.split(','));
    program
      .command('core:start')
      .option('-h, --hot', 'Run front-end with HRM enabled')
      .option('-T, --noTsCheck', 'Run bundler without TS type checking')
      .option('-t, --watchTheme', 'Watch for theme changes and regenerate variables.scss files')
      .description('Starts Grafana front-end in development mode with watch enabled')
      .action(async cmd => {
        await execTask(startTask)({
          watchThemes: cmd.watchTheme,
          noTsCheck: cmd.noTsCheck,
          hot: cmd.hot,
        });
      });

    program
      .command('package:build')
      .option('-s, --scope <packages>', 'packages=[data|runtime|ui|toolkit|e2e|e2e-selectors]')
      .description('Builds @grafana/* package to packages/grafana-*/dist')
      .action(async cmd => {
        await execTask(buildPackageTask)({
          scope: cmd.scope,
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
          silent: true,
        });
      });

    program
      .command('cherrypick')
      .option('-e, --enterprise', 'Run task for grafana-enterprise')
      .description('Helps find commits to cherry pick')
      .action(async cmd => {
        await execTask(cherryPickTask)({ enterprise: !!cmd.enterprise });
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
        await execTask(toolkitBuildTask)({});
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

    // React generator
    program
      .command('component:create')
      .description(
        'Scaffold React components. Optionally add test, story and .mdx files. The components are created in the same dir the script is run from.'
      )
      .action(async () => {
        await execTask(componentCreateTask)({});
      });
  }

  program
    .command('plugin:create [name]')
    .description('Creates plugin from template')
    .action(async cmd => {
      await execTask(pluginCreateTask)({ name: cmd, silent: true });
    });

  program
    .command('plugin:build')
    .description('Prepares plugin dist package')
    .action(async cmd => {
      await execTask(pluginBuildTask)({ coverage: false, silent: true });
    });

  program
    .command('plugin:dev')
    .option('-w, --watch', 'Run plugin development mode with watch enabled')
    .option('--yarnlink', 'symlink this project to the local grafana/toolkit')
    .description('Starts plugin dev mode')
    .action(async cmd => {
      await execTask(pluginDevTask)({
        watch: !!cmd.watch,
        yarnlink: !!cmd.yarnlink,
        silent: true,
      });
    });

  program
    .command('plugin:test')
    .option('-u, --updateSnapshot', 'Run snapshots update')
    .option('--coverage', 'Run code coverage')
    .option('--watch', 'Run tests in interactive watch mode')
    .option('--testPathPattern <regex>', 'Run only tests with a path that matches the regex')
    .option('--testNamePattern <regex>', 'Run only tests with a name that matches the regex')
    .description('Executes plugin tests')
    .action(async cmd => {
      await execTask(pluginTestTask)({
        updateSnapshot: !!cmd.updateSnapshot,
        coverage: !!cmd.coverage,
        watch: !!cmd.watch,
        testPathPattern: cmd.testPathPattern,
        testNamePattern: cmd.testNamePattern,
        silent: true,
      });
    });

  program
    .command('plugin:ci-build')
    .option('--finish', 'move all results to the jobs folder', false)
    .description('Build the plugin, leaving results in /dist and /coverage')
    .action(async cmd => {
      await execTask(ciBuildPluginTask)({
        finish: cmd.finish,
      });
    });

  program
    .command('plugin:ci-docs')
    .description('Build the HTML docs')
    .action(async cmd => {
      await execTask(ciBuildPluginDocsTask)({});
    });

  program
    .command('plugin:ci-package')
    .description('Create a zip packages for the plugin')
    .action(async cmd => {
      await execTask(ciPackagePluginTask)({});
    });

  program
    .command('plugin:ci-report')
    .description('Build a report for this whole process')
    .option('--upload', 'upload packages also')
    .action(async cmd => {
      await execTask(ciPluginReportTask)({
        upload: cmd.upload,
      });
    });

  program
    .command('plugin:bundle-managed')
    .description('Builds managed plugins')
    .action(async cmd => {
      await execTask(bundleManagedTask)({});
    });

  program
    .command('plugin:github-publish')
    .option('--dryrun', 'Do a dry run only', false)
    .option('--verbose', 'Print verbose', false)
    .option('--commitHash <hashKey>', 'Specify the commit hash')
    .description('Publish to github')
    .action(async cmd => {
      await execTask(githubPublishTask)({
        dryrun: cmd.dryrun,
        verbose: cmd.verbose,
        commitHash: cmd.commitHash,
      });
    });

  program
    .command('plugin:update-circleci')
    .description('Update plugin')
    .action(async cmd => {
      await execTask(pluginUpdateTask)({});
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
