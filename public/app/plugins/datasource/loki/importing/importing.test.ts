import { fromString } from '../../graphite/configuration/parseLokiLabelMappings';
import fromGraphiteQueries from './fromGraphite';
import { GraphiteQuery } from '../../graphite/types';
import { GraphiteDatasource } from '../../graphite/datasource';

describe('importing from Graphite queries', () => {
  let graphiteDatasourceMock: GraphiteDatasource;

  function mockSettings(stringMappings: string[]) {
    graphiteDatasourceMock = ({
      getImportQueryConfiguration: () => ({
        loki: {
          mappings: stringMappings.map(fromString),
        },
      }),
      createFuncInstance: (name: string) => ({
        name,
        params: [],
        def: {
          name,
          params: [{ multiple: true }],
        },
        updateText: () => {},
      }),
    } as any) as GraphiteDatasource;
  }

  function mockGraphiteQuery(raw: string): GraphiteQuery {
    return {
      refId: 'A',
      target: raw,
    };
  }

  beforeEach(() => {});

  it('test matching mappings', () => {
    mockSettings(['servers.(cluster).(server).*']);
    const lokiQueries = fromGraphiteQueries(
      [
        // metrics: captured
        mockGraphiteQuery('interpolate(alias(servers.west.001.cpu,1,2))'),
        mockGraphiteQuery('interpolate(alias(servers.east.001.request.POST.200,1,2))'),
        mockGraphiteQuery('interpolate(alias(servers.*.002.*,1,2))'),
        // tags: captured
        mockGraphiteQuery("interpolate(seriesByTag('cluster=west', 'server=002'), inf))"),
        mockGraphiteQuery("interpolate(seriesByTag('foo=bar', 'server=002'), inf))"),
        // regexp
        mockGraphiteQuery('interpolate(alias(servers.eas*.{001,002}.request.POST.200,1,2))'),
        // not captured
        mockGraphiteQuery('interpolate(alias(test.west.001.cpu))'),
        mockGraphiteQuery('interpolate(alias(servers.west.001))'),
      ],
      graphiteDatasourceMock
    );

    expect(lokiQueries).toMatchObject([
      { refId: 'A', expr: '{cluster="west", server="001"}' },
      { refId: 'A', expr: '{cluster="east", server="001"}' },
      { refId: 'A', expr: '{server="002"}' },

      { refId: 'A', expr: '{cluster="west", server="002"}' },
      { refId: 'A', expr: '{foo="bar", server="002"}' },

      { refId: 'A', expr: '{cluster=~"^eas.*", server=~"^(001|002)"}' },

      { refId: 'A', expr: '' },
      { refId: 'A', expr: '' },
    ]);
  });
});
