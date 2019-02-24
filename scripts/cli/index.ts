import program from 'commander';
import chalk from 'chalk';
import { execTask } from './utils/execTask';

export type Task<T> = (options: T) => Promise<void>;

// TODO: Refactor to commander commands
// This will enable us to have command scoped options and limit the ifs below
program
  .option('-h, --hot', 'Runs front-end with hot reload enabled')
  .option('-t, --theme', 'Watches for theme changes and regenerates variables.scss files')
  .option('-d, --depreciate <scripts>', 'Inform about npm script deprecation', v => v.split(','))
  .option('-b, --build', 'Created @grafana/ui build')
  .option('-r, --release', 'Releases @grafana/ui to npm')
  .parse(process.argv);

if (program.build) {
  execTask('grafanaui.build');
} else if (program.release) {
  execTask('grafanaui.release');
} else {
  if (program.depreciate && program.depreciate.length === 2) {
    console.log(
      chalk.yellow.bold(
        `[NPM script depreciation] ${program.depreciate[0]} is deprecated! Use ${program.depreciate[1]} instead!`
      )
    );
  }
  execTask('core.start', {
    watchThemes: !!program.theme,
    hot: !!program.hot,
  });
}
