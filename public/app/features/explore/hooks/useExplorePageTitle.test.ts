describe('useExplorePageTitle', () => {
  //   it('changes the document title of the explore page to include the datasource in use', async () => {
  //     const urlParams = {
  //       left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
  //     };
  //     const { datasources } = setupExplore({ urlParams });
  //     jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
  //     // This is mainly to wait for render so that the left pane state is initialized as that is needed for the title
  //     // to include the datasource
  //     await screen.findByText(`loki Editor input: { label="value"}`);
  //     await waitFor(() => expect(document.title).toEqual('Explore - loki - Grafana'));
  //   });
  //   it('changes the document title to include the two datasources in use in split view mode', async () => {
  //     const urlParams = {
  //       left: JSON.stringify(['now-1h', 'now', 'loki', { expr: '{ label="value"}' }]),
  //     };
  //     const { datasources, store } = setupExplore({ urlParams });
  //     jest.mocked(datasources.loki.query).mockReturnValue(makeLogsQueryResponse());
  //     jest.mocked(datasources.elastic.query).mockReturnValue(makeLogsQueryResponse());
  //     // This is mainly to wait for render so that the left pane state is initialized as that is needed for splitOpen
  //     // to work
  //     await screen.findByText(`loki Editor input: { label="value"}`);
  //     act(() => {
  //       store.dispatch(mainState.splitOpen({ datasourceUid: 'elastic', query: { expr: 'error', refId: 'A' } }));
  //     });
  //     await waitFor(() => expect(document.title).toEqual('Explore - loki | elastic - Grafana'));
  //   });
});
