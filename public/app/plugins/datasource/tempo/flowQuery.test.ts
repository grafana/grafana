import {
  composeFilter,
  composeFacetQuery,
  composeTopologyCountQuery,
  composeTopologyBytesQuery,
  FLOW_FACETS,
  type FlowFacetFilter,
} from './flowQuery';

const facet = (key: string) => FLOW_FACETS.find((f) => f.key === key)!;

describe('composeFilter', () => {
  it('returns an empty matcher when there are no filters', () => {
    expect(composeFilter([])).toBe('{}');
  });

  it('emits a single string predicate with quotes', () => {
    const filters: FlowFacetFilter[] = [{ key: 'direction', values: ['egress'] }];
    expect(composeFilter(filters)).toBe('{ span.flow.direction = "egress" }');
  });

  it('emits an unquoted boolean predicate', () => {
    const filters: FlowFacetFilter[] = [{ key: 'tcpRst', values: ['true'] }];
    expect(composeFilter(filters)).toBe('{ span.flow.tcp.rst = true }');
  });

  it('emits an unquoted numeric predicate', () => {
    const filters: FlowFacetFilter[] = [{ key: 'destPort', values: ['443'] }];
    expect(composeFilter(filters)).toBe('{ span.destination.port = 443 }');
  });

  it('OR-joins multiple values of the same facet via regex', () => {
    const filters: FlowFacetFilter[] = [{ key: 'destination', values: ['1.2.3.4', '5.6.7.8'] }];
    expect(composeFilter(filters)).toBe('{ span.destination.address =~ "1\\.2\\.3\\.4|5\\.6\\.7\\.8" }');
  });

  it('AND-joins multiple facets', () => {
    const filters: FlowFacetFilter[] = [
      { key: 'direction', values: ['egress'] },
      { key: 'transport', values: ['tcp'] },
    ];
    expect(composeFilter(filters)).toBe('{ span.flow.direction = "egress" && span.network.transport = "tcp" }');
  });
});

describe('composeFacetQuery', () => {
  it('appends count_over_time grouped by the facet attribute', () => {
    const filters: FlowFacetFilter[] = [{ key: 'direction', values: ['egress'] }];
    expect(composeFacetQuery(filters, facet('destination'))).toBe(
      '{ span.flow.direction = "egress" } | count_over_time() by (span.destination.address)'
    );
  });
});

describe('topology queries', () => {
  it('groups count by host and destination', () => {
    expect(composeTopologyCountQuery([])).toBe(
      '{} | count_over_time() by (resource.service.name, span.destination.address)'
    );
  });

  it('sums io bytes by host and destination', () => {
    expect(composeTopologyBytesQuery([])).toBe(
      '{} | sum_over_time(span.flow.io.bytes) by (resource.service.name, span.destination.address)'
    );
  });
});
