import config from '@grafana/plugin-configs/webpack.config';

const configWithFallback = async (env: Record<string, unknown>) => {
  const response = await config(env);
  if (response !== undefined && response.resolve !== undefined) {
    response.resolve.fallback = {
      ...response.resolve.fallback,
      stream: false,
      string_decoder: false,
    };
  }
  return response;
};

export default configWithFallback;
