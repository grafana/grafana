import { GraphiteQuery } from './types';

type LegacyAnnotation = {
  target?: string;
  tags?: string;
};

// this becomes the target in the migrated annotations
const migrateLegacyAnnotation = (json: LegacyAnnotation): GraphiteQuery => {
  return {
    queryType: 'events',
    eventsQuery: {
      fromAnnotations: true,
      target: json.target,
      tags: json.tags,
    },
  } as GraphiteQuery;
};

export const prepareAnnotation = (json: any) => {
  // annotation attributes are either 'tags' or 'target'(a graphite query string)
  // because the new annotations will also have a target attribute, {}
  // we need to handle the ambiguous 'target' when migrating legacy annotations
  // so, to migrate legacy annotations
  // we check that target is a string
  // or
  // there is a tags attringbute with no target
  const targetAnnotation = typeof json.target === 'string' || json.target instanceof String;
  const tagsAnnotation = json.tags && !json.target;

  json.target = targetAnnotation || tagsAnnotation ? migrateLegacyAnnotation(json) : json.target;
  return json;
};
