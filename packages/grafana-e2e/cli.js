const execa = require('execa');
const program = require('commander');
const { resolve, sep } = require('path');

const cypress = commandName => {
  // Support running an unpublished dev build
  const dirname = __dirname.split(sep).pop();
  const projectPath = resolve(`${__dirname}${dirname === 'dist' ? '/..' : ''}`);

  const cypressOptions = [commandName, '--env', `CWD=${process.cwd()}`, `--project=${projectPath}`];

  const execaOptions = {
    cwd: __dirname,
    stdio: 'inherit',
  };

  return execa(`${projectPath}/node_modules/.bin/cypress`, cypressOptions, execaOptions)
    .then(() => {}) // no return value
    .catch(error => console.error(error.message));
};

module.exports = () => {
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
