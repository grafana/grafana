import { CLI_TIMEOUT, runToolkit } from './helpers';

describe('plugin:build', () => {
  it(
    'works',
    () =>
      runToolkit({
        argv: ['plugin:build'],
        fixture: 'plugin',
      }),
    CLI_TIMEOUT
  );
});
