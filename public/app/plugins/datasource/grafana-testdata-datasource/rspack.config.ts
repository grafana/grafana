import config, { type Env } from '@grafana/plugin-configs/rspack.config.ts';

export default (env: Env) => config(env, import.meta.dirname);
