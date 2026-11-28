import { getBackendSrv } from '@grafana/runtime';

import { searchEntities } from './kgEntities';

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  getBackendSrv: jest.fn(),
}));

jest.mock('../dataSources', () => ({
  requireDataSource: jest.fn().mockResolvedValue('kg-uid'),
}));

const post = jest.fn();

beforeEach(() => {
  post.mockReset();
  jest.mocked(getBackendSrv).mockReturnValue({ post } as unknown as ReturnType<typeof getBackendSrv>);
});

const entity = (id: number, name: string, extra: Record<string, unknown> = {}) => ({
  id,
  type: 'Service',
  name,
  ...extra,
});

describe('searchEntities', () => {
  it('searches the chosen knowledge graph for the entity type', async () => {
    post.mockResolvedValue({ data: { entities: [], lastPage: true } });

    await searchEntities('Service', 1000, 2000);

    expect(post).toHaveBeenCalledWith(
      '/api/datasources/uid/kg-uid/resources/api-server/v1/search',
      expect.objectContaining({
        timeCriteria: { start: 1000, end: 2000 },
        filterCriteria: [expect.objectContaining({ entityType: 'Service' })],
      }),
      { showErrorAlert: false }
    );
  });

  it('maps scope, service type, severity and insight names', async () => {
    post.mockResolvedValue({
      data: {
        entities: [
          entity(1, 'checkout', {
            scope: { env: 'prod', namespace: 'shop' },
            properties: { service_type: 'instrumented' },
            assertion: { severity: 'critical', assertions: [{ assertionName: 'ErrorRatioBreach' }, {}] },
          }),
        ],
        lastPage: true,
      },
    });

    const { entities } = await searchEntities('Service', 0, 1);

    expect(entities).toEqual([
      {
        id: 1,
        name: 'checkout',
        type: 'Service',
        env: 'prod',
        namespace: 'shop',
        serviceType: 'instrumented',
        severity: 'critical',
        insights: ['ErrorRatioBreach'],
      },
    ]);
  });

  it('lists entities with the worst severity first, then by insight count, then by name', async () => {
    const insight = { assertionName: 'x' };
    post.mockResolvedValue({
      data: {
        entities: [
          entity(1, 'b-quiet', { assertion: { amend: false } }),
          entity(2, 'a-quiet'),
          entity(3, 'warn', { assertion: { severity: 'warning', assertions: [insight] } }),
          entity(4, 'crit-one', { assertion: { severity: 'critical', assertions: [insight] } }),
          entity(5, 'crit-two', { assertion: { severity: 'critical', assertions: [insight, insight] } }),
        ],
        lastPage: true,
      },
    });

    const { entities } = await searchEntities('Service', 0, 1);

    expect(entities.map((e) => e.name)).toEqual(['crit-two', 'crit-one', 'warn', 'a-quiet', 'b-quiet']);
  });

  it('ignores a severity it does not know', async () => {
    post.mockResolvedValue({
      data: { entities: [entity(1, 'a', { assertion: { severity: 'bogus' } })], lastPage: true },
    });

    const { entities } = await searchEntities('Service', 0, 1);

    expect(entities[0].severity).toBeUndefined();
  });

  it('reports a partial result when the graph has more pages', async () => {
    post.mockResolvedValue({ data: { entities: [entity(1, 'a')], lastPage: false } });

    await expect(searchEntities('Service', 0, 1)).resolves.toMatchObject({ complete: false });
  });

  it('returns no entities when the response has none', async () => {
    post.mockResolvedValue({});

    await expect(searchEntities('Service', 0, 1)).resolves.toEqual({ entities: [], complete: true });
  });
});
