import { config } from '@grafana/runtime';

import { getGrotLoadingGameRoutes } from './routes';

describe('getGrotLoadingGameRoutes', () => {
  function withEnv(env: string) {
    return { ...config, buildInfo: { ...config.buildInfo, env } };
  }

  it('registers the playground in development builds', () => {
    expect(getGrotLoadingGameRoutes(withEnv('development')).map((r) => r.path)).toEqual(['/grot-game']);
  });

  it('registers nothing in production builds', () => {
    expect(getGrotLoadingGameRoutes(withEnv('production'))).toEqual([]);
  });
});
