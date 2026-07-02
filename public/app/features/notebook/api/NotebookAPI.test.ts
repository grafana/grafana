import { getK8sNotebookApiConfig } from './NotebookAPI';

describe('getK8sNotebookApiConfig', () => {
  it('points at the notebooks resource in the dashboard.grafana.app group', () => {
    // The endpoint identity is what keeps a notebook fetch off the dashboards path;
    // a typo here would silently route notebook reads to the wrong resource.
    expect(getK8sNotebookApiConfig()).toEqual({
      group: 'dashboard.grafana.app',
      version: 'v2beta1',
      resource: 'notebooks',
    });
  });
});
