// it is possible to add fields into the `InfluxQueryTag` structures, and they do work,
// but in some cases, when we do metadata queries, we have to remove them from the queries.
import { InfluxQueryTag } from '../../../../../types';

export function filterTags(parts: InfluxQueryTag[], allTagKeys: Set<string>): InfluxQueryTag[] {
  return parts.filter((t) => t.key.endsWith('::tag') || allTagKeys.has(t.key + '::tag'));
}
