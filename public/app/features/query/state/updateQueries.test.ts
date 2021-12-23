import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import { updateQueries } from './updateQueries';

describe('updateQueries', () => {
  it('Should update all queries except expression query when changing data source with same type', () => {
    const updated = updateQueries(
      {
        uid: 'new-uid',
        type: 'same-type',
        meta: {},
      } as any,
      [
        {
          refId: 'A',
          datasource: {
            uid: 'old-uid',
            type: 'same-type',
          },
        },
        {
          refId: 'B',
          datasource: ExpressionDatasourceRef,
        },
      ],
      {
        uid: 'old-uid',
        type: 'same-type',
      } as any
    );

    expect(updated[0].datasource).toEqual({ type: 'same-type', uid: 'new-uid' });
    expect(updated[1].datasource).toEqual(ExpressionDatasourceRef);
  });

  it('Should clear queries when changing type', () => {
    const updated = updateQueries(
      {
        uid: 'new-uid',
        type: 'new-type',
        meta: {},
      } as any,
      [
        {
          refId: 'A',
          datasource: {
            uid: 'old-uid',
            type: 'old-type',
          },
        },
        {
          refId: 'B',
          datasource: {
            uid: 'old-uid',
            type: 'old-type',
          },
        },
      ],
      {
        uid: 'old-uid',
        type: 'old-type',
      } as any
    );

    expect(updated.length).toEqual(1);
    expect(updated[0].datasource).toEqual({ type: 'new-type', uid: 'new-uid' });
  });

  it('Should preserve query data source when changing to mixed', () => {
    const updated = updateQueries(
      {
        uid: 'mixed',
        type: 'mixed',
        meta: {
          mixed: true,
        },
      } as any,
      [
        {
          refId: 'A',
          datasource: {
            uid: 'old-uid',
            type: 'old-type',
          },
        },
        {
          refId: 'B',
          datasource: {
            uid: 'other-uid',
            type: 'other-type',
          },
        },
      ],
      {
        uid: 'old-uid',
        type: 'old-type',
      } as any
    );

    expect(updated[0].datasource).toEqual({ type: 'old-type', uid: 'old-uid' });
    expect(updated[1].datasource).toEqual({ type: 'other-type', uid: 'other-uid' });
  });
});
