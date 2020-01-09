export interface MetricTankResultMeta {
  'schema-name': string;
  'schema-retentions': string; //"1s:35d:20min:5:1542274085,1min:38d:2h:1:true,10min:120d:6h:1:true,2h:2y:6h:2",
}

export interface RetentionInfo {
  resolution: string;
  savedFor: string;
  window: string;
  xxx: any;
  yyy: any;
}

export function parseSchemaRetentions(spec: string): RetentionInfo[] {
  if (!spec) {
    return [];
  }
  return spec.split(',').map(str => {
    const vals = str.split(':');
    return {
      resolution: vals[0],
      savedFor: vals[1],
      window: vals[2],
      xxx: vals[3],
      yyy: vals[4],
    };
  });
}
