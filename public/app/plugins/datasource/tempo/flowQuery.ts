export type FlowView = 'table' | 'topology';

export type FlowFacetKey =
  | 'direction'
  | 'transport'
  | 'host'
  | 'process'
  | 'destination'
  | 'country'
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
  { key: 'country', label: 'Country', attr: 'span.destination.geo.country.iso_code', valueType: 'string' },
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

// Every flow query is scoped to the flow span name so facets, table, and topology
// only consider network.flow spans — a datasource may also carry unrelated traces
// (e.g. the cluster's own application traces), which would otherwise dominate with
// nil flow attributes.
export const FLOW_SPAN_MATCHER = 'name = "network.flow"';

export function composeFilter(filters: FlowFacetFilter[]): string {
  const parts = [
    FLOW_SPAN_MATCHER,
    ...filters.filter((f) => f.values.length > 0).map((f) => predicate(facetByKey[f.key], f.values)),
  ];
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

// Columns for the aggregated flow table. TraceQL metrics caps `by()` at 5 group
// values, so this is the 5-tuple we group by; Country stays a facet for now.
export const FLOW_TABLE_COLUMNS: ReadonlyArray<{ attr: string; label: string }> = [
  { attr: 'resource.service.name', label: 'Host' },
  { attr: 'span.process.executable.name', label: 'Process' },
  { attr: 'span.destination.address', label: 'Destination' },
  { attr: 'span.destination.port', label: 'Port' },
  { attr: 'span.network.transport', label: 'Transport' },
];

const FLOW_TABLE_GROUP_BY = FLOW_TABLE_COLUMNS.map((c) => c.attr).join(', ');

export function composeFlowTableCountQuery(filters: FlowFacetFilter[]): string {
  return `${composeFilter(filters)} | count_over_time() by (${FLOW_TABLE_GROUP_BY})`;
}

export function composeFlowTableBytesQuery(filters: FlowFacetFilter[]): string {
  return `${composeFilter(filters)} | sum_over_time(span.flow.io.bytes) by (${FLOW_TABLE_GROUP_BY})`;
}

// Destination -> country lookup. Country is 1:1 with destination, so we fetch it
// separately (2 group-by) and join it onto the flow table — the table's own group-by
// is already at the 5-value TraceQL limit.
export function composeFlowCountryMapQuery(filters: FlowFacetFilter[]): string {
  return `${composeFilter(filters)} | count_over_time() by (span.destination.address, span.destination.geo.country.iso_code)`;
}

// TraceQL serializes string attribute values in metrics-series labels wrapped in
// double quotes (e.g. `"egress"`). Strip one surrounding pair so values display
// cleanly and round-trip correctly back into composeFilter. Numeric/boolean
// labels are unquoted and pass through unchanged.
export function unquoteLabel(value: string): string {
  if (value.length >= 2 && value.startsWith('"') && value.endsWith('"')) {
    return value.slice(1, -1);
  }
  return value;
}
