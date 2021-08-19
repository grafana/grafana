import { getPropsWithVariable } from './utils';

describe('getPropsWithVariable', () => {
  it('when called it should return the correct graph', () => {
    const result = getPropsWithVariable(
      '$unknownVariable',
      {
        key: 'model',
        value: {
          templating: {
            list: [
              {
                current: {
                  selected: false,
                  text: 'No data sources found',
                  value: '',
                },
                hide: 0,
                includeAll: false,
                label: null,
                multi: false,
                name: 'dependsOnUnknown',
                options: [],
                query: 'prometheus',
                refresh: 1,
                regex: '/.*$unknownVariable.*/',
                skipUrlSync: false,
                type: 'datasource',
              },
            ],
          },
        },
      },
      {}
    );

    expect(result).toEqual({
      templating: {
        list: {
          dependsOnUnknown: {
            regex: '/.*$unknownVariable.*/',
          },
        },
      },
    });
  });

  it('when called with a valid an id that is not part of valid names it should return the correct graph', () => {
    const value = {
      targets: [
        {
          id: 'A',
          description: '$tag_host-[[tag_host]]',
          query:
            'SELECT mean(total) AS "total" FROM "disk" WHERE "host" =~ /$host$/ AND $timeFilter GROUP BY time($interval), "host", "path"',
          alias: '$tag_host [[tag_host]] $col $host',
        },
      ],
    };

    const result = getPropsWithVariable(
      'host',
      {
        key: 'model',
        value,
      },
      {}
    );

    expect(result).toEqual({
      targets: {
        A: {
          alias: '$tag_host [[tag_host]] $col $host',
          query:
            'SELECT mean(total) AS "total" FROM "disk" WHERE "host" =~ /$host$/ AND $timeFilter GROUP BY time($interval), "host", "path"',
        },
      },
    });
  });

  it('when called with an id that is part of valid alias names it should return the correct graph', () => {
    const value = {
      targets: [
        {
          id: 'A',
          description: '[[tag_host1]]',
          description2: '$tag_host1',
          query:
            'SELECT mean(total) AS "total" FROM "disk" WHERE "host" =~ /$host$/ AND $timeFilter GROUP BY time($interval), "host", "path"',
          alias: '[[tag_host1]] $tag_host1 $col $host',
        },
      ],
    };

    const tagHostResult = getPropsWithVariable(
      'tag_host1',
      {
        key: 'model',
        value,
      },
      {}
    );

    expect(tagHostResult).toEqual({
      targets: {
        A: {
          description: '[[tag_host1]]',
          description2: '$tag_host1',
        },
      },
    });
  });

  it('when called with an id that is part of valid query names it should return the correct graph', () => {
    const value = {
      targets: [
        {
          id: 'A',
          description: '[[timeFilter]]',
          description2: '$timeFilter',
          query:
            'SELECT mean(total) AS "total" FROM "disk" WHERE "host" =~ /$host$/ AND $timeFilter GROUP BY time($interval), "host", "path"',
          alias: '[[timeFilter]] $timeFilter $col $host',
        },
      ],
    };

    const tagHostResult = getPropsWithVariable(
      'timeFilter',
      {
        key: 'model',
        value,
      },
      {}
    );

    expect(tagHostResult).toEqual({
      targets: {
        A: {
          description: '[[timeFilter]]',
          description2: '$timeFilter',
          alias: '[[timeFilter]] $timeFilter $col $host',
        },
      },
    });
  });
});
