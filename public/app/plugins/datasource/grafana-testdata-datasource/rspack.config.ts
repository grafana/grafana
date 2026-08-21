import config, { type Env } from '@grafana/plugin-configs/rspack.config.ts';

export default async (env: Env) => config(env, import.meta.dirname);
