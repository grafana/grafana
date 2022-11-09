import chalk from 'chalk';
import { program } from 'commander';

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
        console.warn(
          '@grafana/toolkit package:build task is deprecated and will be removed in @grafana/toolkit@10.0.0.'
        );
        await execTask(buildPackageTask)({
          scope: cmd.scope,
        });
      });

    program
      .command('node-version-check')
      .description('[deprecated] Verify node version')
      .action(async () => {
        chalk.yellow.bold(
          `⚠️ This command is deprecated and will be removed in v10. No further support will be provided. ⚠️`
        );
        console.log(
          'if you were reliant on this command we recommend https://www.npmjs.com/package/check-node-version'
        );

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
      .description('[Deprecated] Prepares grafana/toolkit dist package')
      .action(async (cmd) => {
        chalk.yellow.bold(
          `⚠️ This command is deprecated and will be removed in v10. No further support will be provided. ⚠️`
        );
        await execTask(toolkitBuildTask)({});
      });

    program
      .command('searchTestData')
      .option('-c, --count <number_of_dashboards>', 'Specify number of dashboards')
      .description('[deprecated] Setup test data for search')
      .action(async (cmd) => {
        chalk.yellow.bold(
          `⚠️ This command is deprecated and will be removed in v10. No further support will be provided. ⚠️`
        );
        await execTask(searchTestDataSetupTask)({ count: cmd.count });
      });

    // React generator
    program
      .command('component:create')
      .description(
        '[deprecated] Scaffold React components. Optionally add test, story and .mdx files. The components are created in the same dir the script is run from.'
      )
      .action(async () => {
        chalk.yellow.bold(
          `⚠️ This command is deprecated and will be removed in v10. No further support will be provided. ⚠️`
        );
        console.log(
          'if you were reliant on this command we recommend https://www.npmjs.com/package/react-gen-component'
        );
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
      chalk.yellow.bold(
        `⚠️ This command is deprecated and will be removed in v10. No further support will be provided. ⚠️`
      );
      await execTask(bundleManagedTask)({});
    });

  program
    .command('plugin:github-publish')
    .option('--dryrun', 'Do a dry run only', false)
    .option('--verbose', 'Print verbose', false)
    .option('--commitHash <hashKey>', 'Specify the commit hash')
    .description('Publish to github')
    .action(async (cmd) => {
      chalk.yellow.bold(`⚠️ This command is deprecated and will be removed . No further support will be provided. ⚠️`);
      console.log(
        'We recommend using github actions directly for plugin releasing. You can find an example here:  https://github.com/grafana/plugin-tools/tree/main/packages/create-plugin/templates/github/ci/.github/workflows'
      );
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
      chalk.yellow.bold(
        `⚠️ This command is deprecated and will be removed in v10. No further support will be provided. ⚠️`
      );
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
