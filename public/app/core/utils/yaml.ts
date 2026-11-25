import { CORE_SCHEMA, type LoadOptions, YAMLException, loadAll, mergeTag, timestampTag } from 'js-yaml';

// Prometheus/Alertmanager configs rely on merge keys
const YAML_LOAD_OPTIONS: LoadOptions = { schema: CORE_SCHEMA.withTags(mergeTag, timestampTag) };

// Use `loadAll` to parse the YAML and return undefined on a stream with no documents (empty or comment-only input);
export function loadYaml(text: string, options: LoadOptions = YAML_LOAD_OPTIONS): unknown {
  const docs = loadAll(text, options);
  if (docs.length > 1) {
    throw new YAMLException('expected a single document in the stream, but found more');
  }
  return docs[0];
}
