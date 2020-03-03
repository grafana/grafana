import { resolve, sep } from 'path';
import execa, { Options } from 'execa';
import program from 'commander';

const cypress = (commandName: string) => {
  // Support running an unpublished dev build
  const parentPath = resolve(`${__dirname}/../`);
  const parentDirname = parentPath.split(sep).pop();
  const projectPath = resolve(`${parentPath}${parentDirname === 'dist' ? '/..' : ''}`);

  const cypressOptions = [commandName, '--env', `CWD=${process.cwd()}`, `--project=${projectPath}`];

  const execaOptions: Options = {
    cwd: __dirname,
    stdio: 'inherit',
  };

  return execa(`${projectPath}/node_modules/.bin/cypress`, cypressOptions, execaOptions)
    .then(() => {}) // no return value
    .catch(error => console.error(error.message));
};

export default () => {
  const configOption = '-c, --config <path>';
  const configDescription = 'path to JSON file where configuration values are set; defaults to "cypress.json"';

  program
    .command('open')
    .description('runs tests within the interactive GUI')
    .option(configOption, configDescription)
    .action(() => cypress('open'));

  program
    .command('run')
    .description('runs tests from the CLI without the GUI')
    .option(configOption, configDescription)
    .action(() => cypress('run'));

  program.parse(process.argv);
};
