export type FlowView = 'table' | 'topology';

export type FlowFacetKey =
  | 'direction'
  | 'transport'
  | 'host'
  | 'process'
  | 'destination'
  | 'destPort'
  | 'tcpRst'
  | 'tcpSyn'
  | 'tcpFin'
  | 'open';

export interface FlowFacetDef {
  key: FlowFacetKey;
  label: string;
  attr: string;
  valueType: 'string' | 'number' | 'bool';
}

export interface FlowFacetFilter {
  key: FlowFacetKey;
  values: string[];
}

// Attribute strings mirror the flotel network.flow schema (semconv.go).
export const FLOW_FACETS: FlowFacetDef[] = [
  { key: 'direction', label: 'Direction', attr: 'span.flow.direction', valueType: 'string' },
  { key: 'transport', label: 'Transport', attr: 'span.network.transport', valueType: 'string' },
  { key: 'host', label: 'Host', attr: 'resource.service.name', valueType: 'string' },
  { key: 'process', label: 'Process', attr: 'span.process.executable.name', valueType: 'string' },
  { key: 'destination', label: 'Destination', attr: 'span.destination.address', valueType: 'string' },
  { key: 'destPort', label: 'Dest port', attr: 'span.destination.port', valueType: 'number' },
  { key: 'tcpRst', label: 'TCP RST', attr: 'span.flow.tcp.rst', valueType: 'bool' },
  { key: 'tcpSyn', label: 'TCP SYN', attr: 'span.flow.tcp.syn', valueType: 'bool' },
  { key: 'tcpFin', label: 'TCP FIN', attr: 'span.flow.tcp.fin', valueType: 'bool' },
  { key: 'open', label: 'Open', attr: 'span.flow.open', valueType: 'bool' },
];

const facetByKey: Record<string, FlowFacetDef> = Object.fromEntries(FLOW_FACETS.map((f) => [f.key, f]));

// Escape regex metacharacters so an exact value used in a =~ alternation matches literally.
function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Escape a double-quoted TraceQL string value.
function escapeString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

function predicate(facet: FlowFacetDef, values: string[]): string {
  if (values.length > 1) {
    // escapeRegex makes each term match literally (backslashes are already doubled).
    // A subsequent pass escapes any bare " so it cannot break out of the TraceQL
    // double-quoted regex string — escapeRegex does not cover double-quotes.
    const alt = values.map((v) => escapeRegex(v).replace(/"/g, '\\"')).join('|');
    return `${facet.attr} =~ "${alt}"`;
  }
  const v = values[0];
  if (facet.valueType === 'bool' || facet.valueType === 'number') {
    return `${facet.attr} = ${v}`;
  }
  return `${facet.attr} = "${escapeString(v)}"`;
}

export function composeFilter(filters: FlowFacetFilter[]): string {
  const parts = filters
    .filter((f) => f.values.length > 0)
    .map((f) => predicate(facetByKey[f.key], f.values));
  if (parts.length === 0) {
    return '{}';
  }
  return `{ ${parts.join(' && ')} }`;
}

export function composeFacetQuery(filters: FlowFacetFilter[], facet: FlowFacetDef): string {
  return `${composeFilter(filters)} | count_over_time() by (${facet.attr})`;
}

export function composeTopologyCountQuery(filters: FlowFacetFilter[]): string {
  return `${composeFilter(filters)} | count_over_time() by (resource.service.name, span.destination.address)`;
}

export function composeTopologyBytesQuery(filters: FlowFacetFilter[]): string {
  return `${composeFilter(filters)} | sum_over_time(span.flow.io.bytes) by (resource.service.name, span.destination.address)`;
}
