import chalk from 'chalk';
import { program } from 'commander';

import { getToolkitVersion } from './tasks/plugin.utils';
import { templateTask } from './tasks/template';
import { execTask } from './utils/execTask';

export const run = (includeInternalScripts = false) => {
  if (includeInternalScripts) {
    program.option('-d, --depreciate <scripts>', 'Inform about npm script deprecation', (v) => v.split(','));

    program
      .command('debug:template')
      .description('Just testing')
      .action(async () => {
        await execTask(templateTask)({});
      });
  }

  program.option('-v, --version', 'Toolkit version').action(async () => {
    const version = getToolkitVersion();
    console.log(`v${version}`);
  });

  program
    .command('plugin:create [name]')
    .description('[removed] Use grafana create-plugin instead')
    .action(async () => {
      console.log(
        'No longer supported. Use grafana create-plugin https://github.com/grafana/plugin-tools/tree/main/packages/create-plugin\n'
      );
      process.exit(1);
    });

  program
    .command('plugin:build')
    .option('--maxJestWorkers <num>|<string>', 'Limit number of Jest workers spawned')
    .option('--coverage', 'Run code coverage', false)
    .option('--skipTest', 'Skip running tests (for pipelines that run it separate)', false)
    .option('--skipLint', 'Skip running lint (for pipelines that run it separate)', false)
    .option('--preserveConsole', 'Preserves console calls', false)
    .description('[removed] Use grafana create-plugin instead')
    .action(async () => {
      console.log(
        'No longer supported. Use grafana create-plugin https://github.com/grafana/plugin-tools/tree/main/packages/create-plugin\n'
      );
      process.exit(1);
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
    .description('[removed] Use grafana sign-plugin instead')
    .action(() => {
      console.log(
        'No longer supported. Use grafana sign-plugin https://github.com/grafana/plugin-tools/tree/main/packages/sign-plugin\n'
      );
      process.exit(1);
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
