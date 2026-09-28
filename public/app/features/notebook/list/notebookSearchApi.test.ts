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

  it.each([404, 405])('skips later searches without fetching full notebooks after a %i', async (status) => {
    const post = jest.spyOn(backendSrv, 'post').mockRejectedValue({ status, data: {} });
    const get = jest.spyOn(backendSrv, 'get');

    await expect(searchNotebookTitles('incident', 10)).resolves.toEqual([]);
    await expect(searchNotebookTitles('another', 10)).resolves.toEqual([]);
    expect(post).toHaveBeenCalledTimes(1);
    expect(get).not.toHaveBeenCalled();
  });

  it('skips search when the notebook list already found the route missing', async () => {
    markNotebookSearchUnavailable({ status: 404, data: {} });
    const post = jest.spyOn(backendSrv, 'post');

    await expect(searchNotebookTitles('incident', 10)).resolves.toEqual([]);
    expect(post).not.toHaveBeenCalled();
  });

  it('does not hide a 404 after search has succeeded', async () => {
    const post = jest.spyOn(backendSrv, 'post').mockResolvedValueOnce({ items: [] });
    await searchNotebookTitles('incident', 10);
    post.mockRejectedValue({ status: 404, data: {} });

    await expect(searchNotebookTitles('another', 10)).rejects.toEqual({ status: 404, data: {} });
    expect(post).toHaveBeenCalledTimes(2);
  });
});
