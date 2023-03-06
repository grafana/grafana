type LegacyAnnotation = {
  query?: string;
  queryType?: string;
  fromAnnotations?: boolean;
  tagsColumn?: string;
  textColumn?: string;
  timeEndColumn?: string;
  titleColumn?: string;
  name?: string;
};

// this becomes the target in the migrated annotations
const migrateLegacyAnnotation = (json: LegacyAnnotation) => {
  return {
    query: json.query ?? '',
    queryType: 'tags',
    fromAnnotations: true,
    tagsColumn: json.tagsColumn ?? '',
    textColumn: json.textColumn ?? '',
    timeEndColumn: json.timeEndColumn ?? '',
    titleColumn: json.titleColumn ?? '',
    name: json.name ?? '',
  };
};

// eslint-ignore-next-line
export const prepareAnnotation = (json: any) => {
  json.target = json.target ?? migrateLegacyAnnotation(json);

  return json;
};
