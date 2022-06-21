import chalk from 'chalk';
import { program } from 'commander';

import { changelogTask } from './tasks/changelog';
import { cherryPickTask } from './tasks/cherrypick';
import { closeMilestoneTask } from './tasks/closeMilestone';
import { componentCreateTask } from './tasks/component.create';
import { nodeVersionCheckerTask } from './tasks/nodeVersionChecker';
import { buildPackageTask } from './tasks/package.build';
import { pluginBuildTask } from './tasks/plugin.build';
import { ciBuildPluginTask, ciPackagePluginTask, ciPluginReportTask } from './tasks/plugin.ci';
import { pluginCreateTask } from './tasks/plugin.create';
import { pluginDevTask } from './tasks/plugin.dev';
import { pluginSignTask } from './tasks/plugin.sign';
import { pluginTestTask } from './tasks/plugin.tests';
import { pluginUpdateTask } from './tasks/plugin.update';
import { getToolkitVersion, githubPublishTask } from './tasks/plugin.utils';
import { bundleManagedTask } from './tasks/plugin/bundle.managed';
import { searchTestDataSetupTask } from './tasks/searchTestDataSetup';
import { templateTask } from './tasks/template';
import { toolkitBuildTask } from './tasks/toolkit.build';
import { execTask } from './utils/execTask';

export const run = (includeInternalScripts = false) => {
  if (includeInternalScripts) {
    program.option('-d, --depreciate <scripts>', 'Inform about npm script deprecation', (v) => v.split(','));

    program
      .command('package:build')
      .option('-s, --scope <packages>', 'packages=[data|runtime|ui|toolkit|e2e|e2e-selectors]')
      .description('Builds @grafana/* package to packages/grafana-*/dist')
      .action(async (cmd) => {
        await execTask(buildPackageTask)({
          scope: cmd.scope,
        });
      });

    program
      .command('changelog')
      .option('-m, --milestone <milestone>', 'Specify milestone')
      .description('Builds changelog markdown')
      .action(async (cmd) => {
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
      .action(async (cmd) => {
        await execTask(cherryPickTask)({ enterprise: !!cmd.enterprise });
      });

    program
      .command('node-version-check')
      .description('Verify node version')
      .action(async (cmd) => {
        await execTask(nodeVersionCheckerTask)({});
      });

    program
      .command('debug:template')
      .description('Just testing')
      .action(async (cmd) => {
        await execTask(templateTask)({});
      });

    program
      .command('toolkit:build')
      .description('Prepares grafana/toolkit dist package')
      .action(async (cmd) => {
        await execTask(toolkitBuildTask)({});
      });

    program
      .command('searchTestData')
      .option('-c, --count <number_of_dashboards>', 'Specify number of dashboards')
      .description('Setup test data for search')
      .action(async (cmd) => {
        await execTask(searchTestDataSetupTask)({ count: cmd.count });
      });

    program
      .command('close-milestone')
      .option('-m, --milestone <milestone>', 'Specify milestone')
      .option('--dryRun', 'Only simulate actions')
      .description('Helps ends a milestone by removing the cherry-pick label and closing it')
      .action(async (cmd) => {
        if (!cmd.milestone) {
          console.log('Please specify milestone, example: -m <milestone id from github milestone URL>');
          return;
        }

        await execTask(closeMilestoneTask)({
          milestone: cmd.milestone,
          dryRun: !!cmd.dryRun,
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

  program.option('-v, --version', 'Toolkit version').action(async () => {
    const version = getToolkitVersion();
    console.log(`v${version}`);
  });

  program
    .command('plugin:create [name]')
    .description('Creates plugin from template')
    .action(async (cmd) => {
      await execTask(pluginCreateTask)({ name: cmd, silent: true });
    });

  program
    .command('plugin:build')
    .option('--maxJestWorkers <num>|<string>', 'Limit number of Jest workers spawned')
    .option('--coverage', 'Run code coverage', false)
    .option('--skipTest', 'Skip running tests (for pipelines that run it separate)', false)
    .option('--skipLint', 'Skip running lint (for pipelines that run it separate)', false)
    .option('--preserveConsole', 'Preserves console calls', false)
    .description('Prepares plugin dist package')
    .action(async (cmd) => {
      await execTask(pluginBuildTask)({
        coverage: cmd.coverage,
        silent: true,
        maxJestWorkers: cmd.maxJestWorkers,
        preserveConsole: cmd.preserveConsole,
        skipLint: cmd.skipLint,
        skipTest: cmd.skipTest,
      });
    });

  program
    .command('plugin:dev')
    .option('-w, --watch', 'Run plugin development mode with watch enabled')
    .description('Starts plugin dev mode')
    .action(async (cmd) => {
      await execTask(pluginDevTask)({
        watch: !!cmd.watch,
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
    .option('--maxWorkers <num>|<string>', 'Limit number of workers spawned')
    .description('Executes plugin tests')
    .action(async (cmd) => {
      await execTask(pluginTestTask)({
        updateSnapshot: !!cmd.updateSnapshot,
        coverage: !!cmd.coverage,
        watch: !!cmd.watch,
        testPathPattern: cmd.testPathPattern,
        testNamePattern: cmd.testNamePattern,
        maxWorkers: cmd.maxWorkers,
        silent: true,
      });
    });

  program
    .command('plugin:sign')
    .option('--signatureType <type>', 'Signature Type')
    .option(
      '--rootUrls <urls...>',
      'Root URLs',
      function (url: string, urls: string[]) {
        if (typeof url !== 'string') {
          return urls;
        }

        const parts = url.split(',');
        urls.push(...parts);

        return urls;
      },
      []
    )
    .description('Create a plugin signature')
    .action(async (cmd) => {
      await execTask(pluginSignTask)({
        signatureType: cmd.signatureType,
        rootUrls: cmd.rootUrls,
        silent: true,
      });
    });

  program
    .command('plugin:ci-build')
    .option('--finish', 'move all results to the jobs folder', false)
    .option('--maxJestWorkers <num>|<string>', 'Limit number of Jest workers spawned')
    .description('[deprecated] Build the plugin, leaving results in /dist and /coverage')
    .action(async (cmd) => {
      await execTask(ciBuildPluginTask)({
        finish: cmd.finish,
        maxJestWorkers: cmd.maxJestWorkers,
      });
    });

  program
    .command('plugin:ci-package')
    .option('--signatureType <type>', 'Signature Type')
    .option('--rootUrls <urls...>', 'Root URLs')
    .option('--signing-admin', 'Use the admin API endpoint for signing the manifest. (deprecated)', false)
    .description('[deprecated] Create a zip packages for the plugin')
    .action(async (cmd) => {
      await execTask(ciPackagePluginTask)({
        signatureType: cmd.signatureType,
        rootUrls: cmd.rootUrls,
      });
    });

  program
    .command('plugin:ci-report')
    .description('[deprecated] Build a report for this whole process')
    .option('--upload', 'upload packages also')
    .action(async (cmd) => {
      await execTask(ciPluginReportTask)({
        upload: cmd.upload,
      });
    });

  program
    .command('plugin:bundle-managed')
    .description('Builds managed plugins')
    .action(async (cmd) => {
      await execTask(bundleManagedTask)({});
    });

  program
    .command('plugin:github-publish')
    .option('--dryrun', 'Do a dry run only', false)
    .option('--verbose', 'Print verbose', false)
    .option('--commitHash <hashKey>', 'Specify the commit hash')
    .description('Publish to github')
    .action(async (cmd) => {
      await execTask(githubPublishTask)({
        dryrun: cmd.dryrun,
        verbose: cmd.verbose,
        commitHash: cmd.commitHash,
      });
    });

  program
    .command('plugin:update-circleci')
    .description('Update plugin')
    .action(async (cmd) => {
      await execTask(pluginUpdateTask)({});
    });

  program.on('command:*', () => {
    console.error('Invalid command: %s\nSee --help for a list of available commands.', program.args.join(' '));
    process.exit(1);
  });

  program.parse(process.argv);

  const options = program.opts();
  if (options.depreciate && options.depreciate.length === 2) {
    console.log(
      chalk.yellow.bold(
        `[NPM script depreciation] ${options.depreciate[0]} is deprecated! Use ${options.depreciate[1]} instead!`
      )
    );
  }
};
