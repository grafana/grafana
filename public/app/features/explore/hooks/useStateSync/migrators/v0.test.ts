// describe('parseUrlState', () => {
//     it('returns default state on empty string', () => {
//       expect(parseUrlState('')).toMatchObject({
//         datasource: null,
//         queries: [],
//         range: DEFAULT_RANGE,
//       });
//     });

//     it('returns a valid Explore state from URL parameter', () => {
//       const paramValue = '{"datasource":"Local","queries":[{"expr":"metric"}],"range":{"from":"now-1h","to":"now"}}';
//       expect(parseUrlState(paramValue)).toMatchObject({
//         datasource: 'Local',
//         queries: [{ expr: 'metric' }],
//         range: {
//           from: 'now-1h',
//           to: 'now',
//         },
//       });
//     });

//     it('returns a valid Explore state from a compact URL parameter', () => {
//       const paramValue = '["now-1h","now","Local",{"expr":"metric"},{"ui":[true,true,true,"none"]}]';
//       expect(parseUrlState(paramValue)).toMatchObject({
//         datasource: 'Local',
//         queries: [{ expr: 'metric' }],
//         range: {
//           from: 'now-1h',
//           to: 'now',
//         },
//       });
//     });

//     it('should not return a query for mode in the url', () => {
//       // Previous versions of Grafana included "Explore mode" in the URL; this should not be treated as a query.
//       const paramValue =
//         '["now-1h","now","x-ray-datasource",{"queryType":"getTraceSummaries"},{"mode":"Metrics"},{"ui":[true,true,true,"none"]}]';
//       expect(parseUrlState(paramValue)).toMatchObject({
//         datasource: 'x-ray-datasource',
//         queries: [{ queryType: 'getTraceSummaries' }],
//         range: {
//           from: 'now-1h',
//           to: 'now',
//         },
//       });
//     });

//     it('should return queries if queryType is present in the url', () => {
//       const paramValue =
//         '["now-1h","now","x-ray-datasource",{"queryType":"getTraceSummaries"},{"ui":[true,true,true,"none"]}]';
//       expect(parseUrlState(paramValue)).toMatchObject({
//         datasource: 'x-ray-datasource',
//         queries: [{ queryType: 'getTraceSummaries' }],
//         range: {
//           from: 'now-1h',
//           to: 'now',
//         },
//       });
//     });
//   });
