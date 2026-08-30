type LegacyAnnotation = {
  target?: string;
  tags?: string | string[];
};

// legacy annotations stored tags as a space-separated string, but Grafana's annotation model
// uses string[] (AnnotationEvent.tags), so both shapes reach this migration
const migrateLegacyTags = (tags: LegacyAnnotation['tags']): string[] => {
  if (Array.isArray(tags)) {
    return tags.filter(Boolean).map(String);
  }

  return (typeof tags === 'string' ? tags : '').split(' ').filter(Boolean);
};

// this becomes the target in the migrated annotations
const migrateLegacyAnnotation = (json: LegacyAnnotation) => {
  // return the target annotation
  if (typeof json.target === 'string' && json.target) {
    return {
      fromAnnotations: true,
      target: json.target,
      textEditor: true,
    };
  }

  // return the tags annotation
  return {
    queryType: 'tags',
    tags: migrateLegacyTags(json.tags),
    fromAnnotations: true,
  };
};

// eslint-ignore-next-line
export const prepareAnnotation = (json: any) => {
  // annotation attributes are either 'tags' or 'target'(a graphite query string)
  // because the new annotations will also have a target attribute, {}
  // we need to handle the ambiguous 'target' when migrating legacy annotations
  // so, to migrate legacy annotations
  // we check that target is a string
  // or
  // there is a tags attribute with no target
  const resultingTarget = json.target && typeof json.target !== 'string' ? json.target : migrateLegacyAnnotation(json);

  json.target = resultingTarget;

  return json;
};
