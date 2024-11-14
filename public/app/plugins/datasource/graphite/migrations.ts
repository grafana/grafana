type LegacyAnnotation = {
  target?: string;
  tags?: string;
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
    tags: (json.tags || '').split(' '),
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
