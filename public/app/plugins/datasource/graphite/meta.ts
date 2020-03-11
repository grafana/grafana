// https://github.com/grafana/metrictank/blob/master/scripts/config/storage-schemas.conf#L15-L46

export interface RetentionInfo {
  interval: string;
  retention?: string;
  chunkspan?: string;
  numchunks?: number;
  ready?: boolean | number; // whether, or as of what data timestamp, the archive is ready for querying.
}

function toInteger(val?: string): number | undefined {
  if (val) {
    return parseInt(val, 10);
  }
  return undefined;
}

function toBooleanOrTimestamp(val?: string): number | boolean | undefined {
  if (val) {
    if (val === 'true') {
      return true;
    }
    if (val === 'false') {
      return false;
    }
    return parseInt(val, 10);
  }
  return undefined;
}

export function parseSchemaRetentions(spec: string): RetentionInfo[] {
  if (!spec) {
    return [];
  }
  return spec.split(',').map(str => {
    const vals = str.split(':');
    return {
      interval: vals[0],
      retention: vals[1],
      chunkspan: vals[2],
      numchunks: toInteger(vals[3]),
      ready: toBooleanOrTimestamp(vals[4]),
    };
  });
}
