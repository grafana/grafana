import { type LinkModel } from '@grafana/data';

import { type FieldDef } from '../logParser';

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

// Matches a TraceQL trace-id lookup, e.g. `{ trace:id = "abc" }`. The quote is back-referenced so both ends match.
const TRACE_ID_QUERY_REGEX = /^\{\s*trace:id\s*=\s*(["`])([0-9A-Fa-f]+)\1\s*\}$/;

export function getTraceIdFromTraceQlQuery(query: string): string | undefined {
  return query.trim().match(TRACE_ID_QUERY_REGEX)?.[2];
}

// A bare Tempo trace id (16 or 32 hex chars) as stored by derived fields that interpolate ${__value.raw}.
const BARE_TRACE_ID_REGEX = /^[0-9a-fA-F]{16}(?:[0-9a-fA-F]{16})?$/;

export function getTraceIdFromTempoQuery(query: string): string | undefined {
  const fromTraceQl = getTraceIdFromTraceQlQuery(query);
  if (fromTraceQl) {
    return fromTraceQl;
  }
  const trimmed = query.trim();
  return BARE_TRACE_ID_REGEX.test(trimmed) ? trimmed : undefined;
}

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
