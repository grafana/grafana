// TODO: Update the tests
describe('usePlotConfig', () => {
  it('tmp', () => {});
});
// import { usePlotConfig } from './hooks';
// import { renderHook } from '@testing-library/react-hooks';
// import { act } from '@testing-library/react';
// import { UPlotConfigBuilder } from './config/UPlotConfigBuilder';
//
// describe('usePlotConfig', () => {
//   it('returns default plot config', async () => {
//     const { result } = renderHook(() => usePlotConfig(0, 0, 'browser', new UPlotConfigBuilder()));
//
//     expect(result.current.currentConfig).toMatchInlineSnapshot(`
//       Object {
//         "axes": Array [],
//         "cursor": Object {
//           "focus": Object {
//             "prox": 30,
//           },
//         },
//         "focus": Object {
//           "alpha": 1,
//         },
//         "height": 0,
//         "hooks": Object {},
//         "legend": Object {
//           "show": false,
//         },
//         "plugins": Array [],
//         "scales": Object {},
//         "series": Array [
//           Object {},
//         ],
//         "tzDate": [Function],
//         "width": 0,
//       }
//     `);
//   });
//
//   describe('plugins config', () => {
//     it('should register plugin', async () => {
//       const { result } = renderHook(() => usePlotConfig(0, 0, 'browser', new UPlotConfigBuilder()));
//       const registerPlugin = result.current.registerPlugin;
//
//       act(() => {
//         registerPlugin({
//           id: 'testPlugin',
//           hooks: {},
//         });
//       });
//
//       expect(Object.keys(result.current.currentConfig?.plugins!)).toHaveLength(1);
//       expect(result.current.currentConfig).toMatchInlineSnapshot(`
//         Object {
//           "axes": Array [],
//           "cursor": Object {
//             "focus": Object {
//               "prox": 30,
//             },
//           },
//           "focus": Object {
//             "alpha": 1,
//           },
//           "height": 0,
//           "hooks": Object {},
//           "legend": Object {
//             "show": false,
//           },
//           "plugins": Array [
//             Object {
//               "hooks": Object {},
//             },
//           ],
//           "scales": Object {},
//           "series": Array [
//             Object {},
//           ],
//           "tzDate": [Function],
//           "width": 0,
//         }
//       `);
//     });
//
//     it('should unregister plugin', async () => {
//       const { result } = renderHook(() => usePlotConfig(0, 0, 'browser', new UPlotConfigBuilder()));
//       const registerPlugin = result.current.registerPlugin;
//
//       let unregister: () => void;
//       act(() => {
//         unregister = registerPlugin({
//           id: 'testPlugin',
//           hooks: {},
//         });
//       });
//
//       expect(Object.keys(result.current.currentConfig?.plugins!)).toHaveLength(1);
//
//       act(() => {
//         unregister();
//       });
//
//       expect(Object.keys(result.current.currentConfig?.plugins!)).toHaveLength(0);
//       expect(result.current.currentConfig).toMatchInlineSnapshot(`
//         Object {
//           "axes": Array [],
//           "cursor": Object {
//             "focus": Object {
//               "prox": 30,
//             },
//           },
//           "focus": Object {
//             "alpha": 1,
//           },
//           "gutters": Object {
//             "x": 8,
//             "y": 8,
//           },
//           "height": 0,
//           "hooks": Object {},
//           "legend": Object {
//             "show": false,
//           },
//           "plugins": Array [],
//           "scales": Object {},
//           "series": Array [
//             Object {},
//           ],
//           "tzDate": [Function],
//           "width": 0,
//         }
//       `);
//     });
//   });
// });
