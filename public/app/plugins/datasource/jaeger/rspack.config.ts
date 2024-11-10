import config from '@grafana/plugin-configs/rspack.config';

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

// eslint-disable-next-line no-barrel-files/no-barrel-files
export default configWithFallback;
