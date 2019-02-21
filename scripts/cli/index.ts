import program from 'commander';
import { startTask } from './start';
import chalk from 'chalk';

program
  .option('-h, --hot', 'Runs front-end with hot reload enabled')
  .option('-t, --theme', 'Watches for theme changes and regenerates variables.scss files')
  .option('-d, --depreciate <scripts>', 'Inform about npm script deprecation', v => v.split(','))
  .parse(process.argv);

if (program.depreciate && program.depreciate.length === 2) {
  console.log(
    chalk.yellow.bold(
      `[NPM script depreciation] ${program.depreciate[0]} is deprecated! Use ${program.depreciate[1]} instead!`
    )
  );
}

startTask({
  watchThemes: !!program.theme,
  hot: !!program.hot,
});
