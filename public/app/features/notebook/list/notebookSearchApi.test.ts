import { BASE_URL } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { searchNotebookTitles } from './notebookSearchApi';
import { __resetSearchAvailabilityForTests, markNotebookSearchUnavailable } from './notebookSearchAvailability';

setBackendSrv(backendSrv);

describe('searchNotebookTitles', () => {
  afterEach(() => {
    jest.restoreAllMocks();
    __resetSearchAvailabilityForTests();
  });

  it('uses the notebook search endpoint with a bounded title query', async () => {
    const items = [
      {
        resource: { group: 'dashboard.grafana.app', resource: 'notebooks', kind: 'Notebook', name: 'nb1' },
        fields: { title: 'Incident notes' },
      },
    ];
    const post = jest.spyOn(backendSrv, 'post').mockResolvedValue({ items });

    await expect(searchNotebookTitles('Incident', 10)).resolves.toEqual(items);
    expect(post).toHaveBeenCalledWith(
      `${BASE_URL}/notebooks/search`,
      {
        apiVersion: 'search.grafana.app/v0alpha1',
        kind: 'SearchQuery',
        where: { text: { value: 'Incident', fields: ['title'] } },
        fields: ['title'],
        limit: 10,
      },
      { showErrorAlert: false }
    );
  });

  it.each([404, 405])('falls back to LIST when search returns %i', async (status) => {
    const post = jest.spyOn(backendSrv, 'post').mockRejectedValue({ status, data: {} });
    const get = jest.spyOn(backendSrv, 'get').mockResolvedValue({
      items: [
        { metadata: { name: 'nb1' }, spec: { title: 'Incident notes' } },
        { metadata: { name: 'nb2' }, spec: { title: 'Another notebook' } },
      ],
    });

    await expect(searchNotebookTitles('incident', 10)).resolves.toEqual([
      {
        resource: { group: 'dashboard.grafana.app', resource: 'notebooks', kind: 'Notebook', name: 'nb1' },
        fields: { title: 'Incident notes' },
      },
    ]);
    expect(get).toHaveBeenCalledWith(`${BASE_URL}/notebooks`, { limit: 500 }, undefined, { showErrorAlert: false });

    await searchNotebookTitles('another', 10);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('uses the shared availability latch when the list already found search missing', async () => {
    markNotebookSearchUnavailable({ status: 404, data: {} });
    const post = jest.spyOn(backendSrv, 'post');
    jest.spyOn(backendSrv, 'get').mockResolvedValue({ items: [] });

    await expect(searchNotebookTitles('incident', 10)).resolves.toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it('does not treat a 404 as an absent route after search already succeeded', async () => {
    const post = jest.spyOn(backendSrv, 'post').mockResolvedValueOnce({ items: [] });
    await searchNotebookTitles('incident', 10);
    post.mockRejectedValue({ status: 404, data: {} });
    const get = jest.spyOn(backendSrv, 'get');

    await expect(searchNotebookTitles('incident', 10)).rejects.toEqual({ status: 404, data: {} });
    expect(get).not.toHaveBeenCalled();
  });
});
