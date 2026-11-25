import { CORE_SCHEMA, type LoadOptions, mergeTag, timestampTag } from 'js-yaml';

// Prometheus/Alertmanager configs rely on merge keys
export const YAML_LOAD_OPTIONS: LoadOptions = { schema: CORE_SCHEMA.withTags(mergeTag, timestampTag) };
