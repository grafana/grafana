import program from 'commander';
import { execTask } from './utils/execTask';
import chalk from 'chalk';
import { startTask } from './tasks/core.start';
import { buildTask } from './tasks/grafanaui.build';
import { releaseTask } from './tasks/grafanaui.release';

program.option('-d, --depreciate <scripts>', 'Inform about npm script deprecation', v => v.split(','));

program
  .command('core:start')
  .option('-h, --hot', 'Run front-end with HRM enabled')
  .option('-t, --watchTheme', 'Watch for theme changes and regenerate variables.scss files')
  .description('Starts Grafana front-end in development mode with watch enabled')
  .action(async cmd => {
    await execTask(startTask)({
      watchThemes: cmd.theme,
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
  .action(async cmd => {
    await execTask(releaseTask)({
      publishToNpm: !!cmd.publish,
    });
  });

program.parse(process.argv);

if (program.depreciate && program.depreciate.length === 2) {
  console.log(
    chalk.yellow.bold(
      `[NPM script depreciation] ${program.depreciate[0]} is deprecated! Use ${program.depreciate[1]} instead!`
    )
  );
}
