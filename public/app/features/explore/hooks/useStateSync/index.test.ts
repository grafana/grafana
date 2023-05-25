describe('useStateSync', () => {});

// describe('Handles different URL datasource redirects', () => {
//     describe('exploreMixedDatasource on', () => {
//       beforeAll(() => {
//         config.featureToggles.exploreMixedDatasource = true;
//       });

//       describe('When root datasource is not specified in the URL', () => {
//         it('Redirects to default datasource', async () => {
//           const { location } = setupExplore({ mixedEnabled: true });
//           await waitForExplore();

//           await waitFor(() => {
//             const urlParams = decodeURIComponent(location.getSearch().toString());

//             expect(urlParams).toBe(
//               'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//             );
//           });
//           expect(location.getHistory()).toHaveLength(1);
//         });

//         it('Redirects to last used datasource when available', async () => {
//           const { location } = setupExplore({
//             prevUsedDatasource: { orgId: 1, datasource: 'elastic-uid' },
//             mixedEnabled: true,
//           });
//           await waitForExplore();

//           await waitFor(() => {
//             const urlParams = decodeURIComponent(location.getSearch().toString());
//             expect(urlParams).toBe(
//               'left={"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//             );
//           });
//           expect(location.getHistory()).toHaveLength(1);
//         });

//         it("Redirects to first query's datasource", async () => {
//           const { location } = setupExplore({
//             urlParams: {
//               left: '{"queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}',
//             },
//             prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
//             mixedEnabled: true,
//           });
//           await waitForExplore();

//           await waitFor(() => {
//             const urlParams = decodeURIComponent(location.getSearch().toString());
//             expect(urlParams).toBe(
//               'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//             );
//           });
//           expect(location.getHistory()).toHaveLength(1);
//         });
//       });

//       describe('When root datasource is specified in the URL', () => {
//         it('Uses the datasource in the URL', async () => {
//           const { location } = setupExplore({
//             urlParams: {
//               left: '{"datasource":"elastic-uid","queries":[{"refId":"A"}],"range":{"from":"now-1h","to":"now"}}',
//             },
//             prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
//             mixedEnabled: true,
//           });
//           await waitForExplore();

//           await waitFor(() => {
//             const urlParams = decodeURIComponent(location.getSearch().toString());
//             expect(urlParams).toBe(
//               'left={"datasource":"elastic-uid","queries":[{"refId":"A"}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//             );
//           });

//           expect(location.getHistory()).toHaveLength(1);
//         });

//         it('Filters out queries not using the root datasource', async () => {
//           const { location } = setupExplore({
//             urlParams: {
//               left: '{"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}},{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}',
//             },
//             prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
//             mixedEnabled: true,
//           });
//           await waitForExplore();

//           await waitFor(() => {
//             const urlParams = decodeURIComponent(location.getSearch().toString());
//             expect(urlParams).toBe(
//               'left={"datasource":"elastic-uid","queries":[{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//             );
//           });
//         });

//         it('Fallbacks to last used datasource if root datasource does not exist', async () => {
//           const { location } = setupExplore({
//             urlParams: { left: '{"datasource":"NON-EXISTENT","range":{"from":"now-1h","to":"now"}}' },
//             prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
//             mixedEnabled: true,
//           });
//           await waitForExplore();

//           await waitFor(() => {
//             const urlParams = decodeURIComponent(location.getSearch().toString());
//             expect(urlParams).toBe(
//               'left={"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//             );
//           });
//         });

//         it('Fallbacks to default datasource if root datasource does not exist and last used datasource does not exist', async () => {
//           const { location } = setupExplore({
//             urlParams: { left: '{"datasource":"NON-EXISTENT","range":{"from":"now-1h","to":"now"}}' },
//             prevUsedDatasource: { orgId: 1, datasource: 'I DO NOT EXIST' },
//             mixedEnabled: true,
//           });
//           await waitForExplore();

//           await waitFor(() => {
//             const urlParams = decodeURIComponent(location.getSearch().toString());
//             expect(urlParams).toBe(
//               'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//             );
//           });
//         });

//         it('Fallbacks to default datasource if root datasource does not exist there is no last used datasource', async () => {
//           const { location } = setupExplore({
//             urlParams: { left: '{"datasource":"NON-EXISTENT","range":{"from":"now-1h","to":"now"}}' },
//             mixedEnabled: true,
//           });
//           await waitForExplore();

//           await waitFor(() => {
//             const urlParams = decodeURIComponent(location.getSearch().toString());
//             expect(urlParams).toBe(
//               'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//             );
//           });
//         });
//       });

//       it('Queries using nonexisting datasources gets removed', async () => {
//         const { location } = setupExplore({
//           urlParams: {
//             left: '{"datasource":"-- Mixed --","queries":[{"refId":"A","datasource":{"type":"NON-EXISTENT","uid":"NON-EXISTENT"}},{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}',
//           },
//           prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
//           mixedEnabled: true,
//         });
//         await waitForExplore();

//         await waitFor(() => {
//           const urlParams = decodeURIComponent(location.getSearch().toString());
//           expect(urlParams).toBe(
//             'left={"datasource":"--+Mixed+--","queries":[{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//           );
//         });
//       });

//       it('Only keeps queries using root datasource', async () => {
//         const { location } = setupExplore({
//           urlParams: {
//             left: '{"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}},{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}',
//           },
//           prevUsedDatasource: { orgId: 1, datasource: 'elastic' },
//           mixedEnabled: true,
//         });

//         await waitForExplore(undefined, true);

//         await waitFor(() => {
//           const urlParams = decodeURIComponent(location.getSearch().toString());
//           // because there are no import/export queries in our mock datasources, only the first one remains

//           expect(urlParams).toBe(
//             'left={"datasource":"elastic-uid","queries":[{"refId":"B","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//           );
//         });
//       });
//     });
//   });

// describe('exploreMixedDatasource off', () => {
//     beforeAll(() => {
//       config.featureToggles.exploreMixedDatasource = false;
//     });

//     it('Redirects to the first query datasource if the root is mixed', async () => {
//       const { location } = setupExplore({
//         urlParams: {
//           left: '{"datasource":"-- Mixed --","queries":[{"refId":"A","datasource":{"type":"logs","uid":"elastic-uid"}},{"refId":"B","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}',
//         },
//         mixedEnabled: false,
//       });

//       await waitForExplore();

//       await waitFor(() => {
//         const urlParams = decodeURIComponent(location.getSearch().toString());

//         expect(urlParams).toBe(
//           'left={"datasource":"elastic-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"elastic-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//         );
//       });
//     });

//     it('Redirects to the default datasource if the root is mixed and there are no queries', async () => {
//       const { location } = setupExplore({
//         urlParams: {
//           left: '{"datasource":"-- Mixed --","range":{"from":"now-1h","to":"now"}}',
//         },
//         mixedEnabled: false,
//       });

//       await waitForExplore();

//       await waitFor(() => {
//         const urlParams = decodeURIComponent(location.getSearch().toString());

//         expect(urlParams).toBe(
//           'left={"datasource":"loki-uid","queries":[{"refId":"A","datasource":{"type":"logs","uid":"loki-uid"}}],"range":{"from":"now-1h","to":"now"}}&orgId=1'
//         );
//       });
//     });
//   });
