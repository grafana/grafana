/**
 * After Grafana migrated to cypress 12 this file is only used by
 * external (non-core) plugins.
 *
 * It is kept here for backwards compatibility and ensures that plugins don't try to run
 * cypress 12 against their incompatible configuration for cypress 9.
 *
 */
const { program } = require('commander');
const execa = require('execa');
const { resolve, sep } = require('path');
const path = require('path');
const resolveBin = require('resolve-bin');

const { getCypressVersion, getCypressBinary } = require('./cli.utils');

const cypressBin = getCypressBinary();

const cypress = (commandName, { updateScreenshots, browser }) => {
  // Support running an unpublished dev build
  const dirname = __dirname.split(sep).pop();
  const projectPath = resolve(`${__dirname}${dirname === 'dist' ? '/..' : ''}`);

  // Check if running the correct version of Cypress
  // Plugins and Grafana core using cypress 12 will never execute this file.
  const cypressVersion = getCypressVersion(cypressBin);
  if (!cypressVersion.startsWith('9')) {
    console.error(
      `\n\n\u001b[31mYou are using an unsupported version of Cypress (${cypressVersion}). Please install Cypress 9.5.1\u001b[0m`
    );
    console.log(`
      For yarn: yarn add -D cypress@9.5.1
      For npm:  npm install -D cypress@9.5.1
      For pnpm: pnpm add -D cypress@9.5.1
    `);

    process.exit(1);
  }

  // For plugins/extendConfig
  const CWD = `CWD=${process.cwd()}`;

  // For plugins/compareSnapshots
  const UPDATE_SCREENSHOTS = `UPDATE_SCREENSHOTS=${updateScreenshots ? 1 : 0}`;

  const cypressOptions = [
    commandName,
    '--env',
    `${CWD},${UPDATE_SCREENSHOTS}`,
    `--project=${projectPath}`,
    // keeping this for backwards compatibility of plugins using cypress 9
    '--config-file',
    resolve(__dirname, 'legacy-cypress.json'),
  ];

  if (browser) {
    cypressOptions.push('--browser', browser);
  }

  const execaOptions = {
    cwd: __dirname,
    stdio: 'inherit',
  };

  return execa(cypressBin, cypressOptions, execaOptions)
    .then(() => {}) // no return value
    .catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
};

module.exports = () => {
  const updateOption = '-u, --update-screenshots';
  const updateDescription = 'update expected screenshots';
  const browserOption = '-b, --browser <browser>';
  const browserDescription = 'specify which browser to use';

  program
    .command('open')
    .description('runs tests within the interactive GUI')
    .option(updateOption, updateDescription)
    .option(browserOption, browserDescription)
    .action((options) => cypress('open', options));

  program
    .command('run')
    .description('runs tests from the CLI without the GUI')
    .option(updateOption, updateDescription)
    .option(browserOption, browserDescription)
    .action((options) => cypress('run', options));

  program.parse(process.argv);
};
