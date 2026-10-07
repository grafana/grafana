import config, { type Env } from '@grafana/plugin-configs/webpack.config.ts';

export default (env: Env) => config(env, import.meta.dirname);
