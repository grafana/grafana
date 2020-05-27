const execa = require('execa');
const program = require('commander');
const resolveBin = require('resolve-as-bin');
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

  return execa(resolveBin('cypress'), cypressOptions, execaOptions)
    .then(() => {}) // no return value
    .catch(error => {
      console.error(error.message);
      process.exitCode = 1;
    });
};

module.exports = () => {
  program
    .command('open')
    .description('runs tests within the interactive GUI')
    .action(() => cypress('open'));

  program
    .command('run')
    .description('runs tests from the CLI without the GUI')
    .action(() => cypress('run'));

  program.parse(process.argv);
};
