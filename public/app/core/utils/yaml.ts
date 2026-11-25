import { CORE_SCHEMA, type LoadOptions, mergeTag, timestampTag } from 'js-yaml';

// js-yaml v5's default schema dropped merge keys (`<<: *anchor`) and timestamps, which v4 parsed;
// Prometheus/Alertmanager configs rely on merge keys, so keep v4's behaviour for those.
export const YAML_LOAD_OPTIONS: LoadOptions = { schema: CORE_SCHEMA.withTags(mergeTag, timestampTag) };
