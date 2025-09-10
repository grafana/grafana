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
  if (link.meta?.internalLink && isTempoQuery(link.meta.internalLink.interpolated?.query)) {
    const query = link.meta.internalLink.interpolated.query;
    return {
      dsUID: query.datasource?.uid || '',
      query: query.query,
      queryType: query.queryType || '',
    }
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
}

const isTempoQuery = (query: unknown): query is TempoQuery => {
  return !(!query || !query.query || !query.queryType);
}
