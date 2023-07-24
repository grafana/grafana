import { mapJaegerDependenciesResponse } from './dependencyGraphTransform';

describe('dependencyGraphTransform', () => {
  it('should transform Jaeger dependencies API response', () => {
    const data = {
      data: [
        {
          parent: 'serviceA',
          child: 'serviceB',
          callCount: 1,
        },
        {
          parent: 'serviceA',
          child: 'serviceC',
          callCount: 2,
        },
        {
          parent: 'serviceB',
          child: 'serviceC',
          callCount: 3,
        },
      ],
      total: 0,
      limit: 0,
      offset: 0,
      errors: null,
    };

    const res = mapJaegerDependenciesResponse({ data });
    expect(res).toMatchObject({
      data: [
        {
          fields: [
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['serviceA', 'serviceB', 'serviceC'],
            },
            {
              config: {},
              name: 'title',
              type: 'string',
              values: ['serviceA', 'serviceB', 'serviceC'],
            },
          ],
          meta: { preferredVisualisationType: 'nodeGraph' },
        },
        {
          fields: [
            {
              config: {},
              name: 'id',
              type: 'string',
              values: ['serviceA--serviceB', 'serviceA--serviceC', 'serviceB--serviceC'],
            },
            {
              config: {},
              name: 'target',
              type: 'string',
              values: ['serviceB', 'serviceC', 'serviceC'],
            },
            {
              config: {},
              name: 'source',
              type: 'string',
              values: ['serviceA', 'serviceA', 'serviceB'],
            },
            {
              config: { displayName: 'Call count' },
              name: 'mainstat',
              type: 'string',
              values: [1, 2, 3],
            },
          ],
          meta: { preferredVisualisationType: 'nodeGraph' },
        },
      ],
    });
  });

  it('should transform Jaeger API error', () => {
    const data = {
      data: null,
      total: 0,
      limit: 0,
      offset: 0,
      errors: [
        {
          code: 400,
          msg: 'unable to parse param \'endTs\': strconv.ParseInt: parsing "foo": invalid syntax',
        },
      ],
    };

    const res = mapJaegerDependenciesResponse({ data });

    expect(res).toEqual({
      data: [],
      errors: [
        {
          message: 'unable to parse param \'endTs\': strconv.ParseInt: parsing "foo": invalid syntax',
          status: 400,
        },
      ],
    });
  });
});
