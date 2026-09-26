import { BASE_URL } from '@grafana/api-clients/rtkq/dashboard/v2beta1';
import { setBackendSrv } from '@grafana/runtime';
import { backendSrv } from 'app/core/services/backend_srv';

import { searchNotebookTitles } from './notebookSearchApi';

setBackendSrv(backendSrv);

describe('searchNotebookTitles', () => {
  afterEach(() => {
    jest.restoreAllMocks();
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
});
