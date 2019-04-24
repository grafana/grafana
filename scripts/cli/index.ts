import program from 'commander';
import { execTask } from './utils/execTask';
import chalk from 'chalk';
import { startTask } from './tasks/core.start';
import { buildTask } from './tasks/grafanaui.build';
import { releaseTask } from './tasks/grafanaui.release';
import { changelogTask } from './tasks/changelog';
import { cherryPickTask } from './tasks/cherrypick';

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

program.parse(process.argv);

if (program.depreciate && program.depreciate.length === 2) {
  console.log(
    chalk.yellow.bold(
      `[NPM script depreciation] ${program.depreciate[0]} is deprecated! Use ${program.depreciate[1]} instead!`
    )
  );
}
