import { LinkModel } from '@grafana/data';

import { FieldDef } from '../logParser';

export function getTempoTraceFromLinks(fields: FieldDef[]) {
  for (const field of fields) {
    if (!field.links) {
      continue;
    }
    for (const link of field.links) {
      const trace = getTempoTraceFromLink(link);
      if (trace) {
        return trace;
      }
    }
  }
  return null;
}

function getTempoTraceFromLink(link: LinkModel) {
  if (link.interpolatedParams?.query && isTempoQuery(link.interpolatedParams.query)) {
    const query = link.interpolatedParams.query;
    return {
      dsUID: query.datasource?.uid || '',
      query: query.query,
      queryType: query.queryType || '',
    };
  } else {
    return undefined;
  }
}

export type EmbeddedInternalLink = {
  dsUID: string;
  query: string;
  queryType: string;
};

type TempoQuery = {
  query: string;
  queryType: string;
};

const isTempoQuery = (query: unknown): query is TempoQuery => {
  if (!query || typeof query !== 'object') {
    return false;
  }
  return 'query' in query && 'queryType' in query;
};
