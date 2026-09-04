import type { Configuration } from '@rspack/core';

import grafanaConfig, { type Env } from '@grafana/plugin-configs/rspack.config.ts';

const config = async (env: Env): Promise<Configuration> => {
  return await grafanaConfig(env, import.meta.dirname);
};

export default config;
