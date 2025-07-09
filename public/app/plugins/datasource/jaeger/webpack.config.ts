import { createRequire } from 'node:module';

import config from '@grafana/plugin-configs/webpack.config.ts';

const require = createRequire(import.meta.url);

const configWithFallback = async (env: Record<string, unknown>) => {
  const response = await config(env);
  if (response !== undefined && response.resolve !== undefined) {
    response.resolve.fallback = {
      ...response.resolve.fallback,
      stream: require.resolve('stream-browserify'),
    };
  }
  return response;
};

export default configWithFallback;
