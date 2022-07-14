import { GraphiteQuery } from './types';

type LegacyAnnotation = {
  // have to handle this target attribute as post migration annotaion will also have a target that is an object
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
  // annotation attributes are wither 'tags' or 'target'
  // when migrating legacy annotations we cannot simply look for these
  // because the post migration annotations will also have a target attribute
  // so, we check that target is a string or the attribute 'tags'
  const isAnnotation = typeof json.target === 'string' || json.target instanceof String || json.tags;
  json.target = isAnnotation ? migrateLegacyAnnotation(json) : json.target;
  return json;
};
