// // import { getDefaultTimeRange } from '@grafana/data';

// import { getDefaultTimeRange } from '@grafana/data';

// import { Scene } from '../components/Scene';
// import { SceneFlexChild, SceneFlexLayout } from '../components/SceneFlexLayout';
// import { ScenePanelRepeater } from '../components/ScenePanelRepeater';
// import { SceneToolbar } from '../components/SceneToolbar';
// import { SceneToolbarInput } from '../components/SceneToolbarButton';
// import { VizPanel } from '../components/VizPanel';
// import { SceneDataProviderNode } from '../core/SceneDataProviderNode';
// import { SceneTimeRange } from '../core/SceneTimeRange';
// import { SceneEditManager } from '../editor/SceneEditManager';

// export function getRepeaterDemo(): Scene {
//   const timeRangeNode1 = new SceneTimeRange({
//     range: getDefaultTimeRange(),
//   });

//   const tolbarInput = new SceneToolbarInput({
//     value: 2,
//   });

//   const dataNode1 = new SceneDataProviderNode({
//     inputParams: { timeRange: timeRangeNode1, tolbarInput },
//     queries: [
//       {
//         refId: 'A',
//         datasource: {
//           uid: 'gdev-testdata',
//           type: 'testdata',
//         },
//         scenarioId: 'random_walk',
//         seriesCount: tolbarInput,
//       },
//     ],
//   });

//   const repeatablePanel = new VizPanel({
//     inputParams: {
//       data: dataNode1,
//     },
//     pluginId: 'timeseries',
//     title: 'Title',
//     options: {
//       legend: { displayMode: 'hidden' },
//     },
//   });

//   const scene = new Scene({
//     $editor: new SceneEditManager({}),
//     title: 'Viz repeater demo',
//     children: [
//       new SceneFlexLayout({
//         direction: 'column',
//         children: [
//           new SceneFlexChild({
//             size: {
//               ySizing: 'content',
//             },
//             children: [
//               new SceneToolbar({
//                 orientation: 'horizontal',
//                 children: [timeRangeNode1, tolbarInput],
//               }),
//             ],
//           }),

//           new SceneFlexChild({
//             children: [
//               new SceneFlexLayout({
//                 children: [
//                   new ScenePanelRepeater({
//                     children: [repeatablePanel],
//                   }),
//                 ],
//               }),
//             ],
//           }),
//         ],
//       }),
//     ],
//   });

//   return scene;
// }

// // export function getScenePanelRepeaterTest(): Scene {
// //   const queryRunner = new SceneQueryRunner({
// //     queries: [
// //       {
// //         refId: 'A',
// //         datasource: {
// //           uid: 'gdev-testdata',
// //           type: 'testdata',
// //         },
// //         seriesCount: 2,
// //         alias: '__server_names',
// //         scenarioId: 'random_walk',
// //       },
// //     ],
// //   });

// //   const scene = new Scene({
// //     title: 'Panel repeater test',
// //     layout: new ScenePanelRepeater({
// //       layout: new SceneFlexLayout({
// //         direction: 'column',
// //         children: [
// //           new SceneFlexLayout({
// //             size: { minHeight: 200 },
// //             children: [
// //               new VizPanel({
// //                 pluginId: 'timeseries',
// //                 title: 'Title',
// //                 options: {
// //                   legend: { displayMode: 'hidden' },
// //                 },
// //               }),
// //               new VizPanel({
// //                 size: { width: 300 },
// //                 pluginId: 'stat',
// //                 fieldConfig: { defaults: { displayName: 'Last' }, overrides: [] },
// //                 options: {
// //                   graphMode: 'none',
// //                 },
// //               }),
// //             ],
// //           }),
// //         ],
// //       }),
// //     }),
// //     $editor: new SceneEditManager({}),
// //     $timeRange: new SceneTimeRange(getDefaultTimeRange()),
// //     $data: queryRunner,
// //     actions: [

// //       new SceneTimePicker({}),
// //     ],
// //   });

// //   return scene;
// // }
