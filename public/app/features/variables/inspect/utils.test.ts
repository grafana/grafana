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
});
