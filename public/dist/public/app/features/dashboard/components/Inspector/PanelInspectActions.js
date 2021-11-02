// const dummySupplier: PanelInspectActionSupplier = {
//   getActions: (panel: PanelModel) => {
//     return [
//       {
//         title: 'Do something',
//         description: 'that thingy',
//         // eslint-disable-next-line react/display-name
//         component: ({ panel }) => {
//           return (
//             <div>
//               DO THING ONE. Panel: <pre>{JSON.stringify(panel.targets)}</pre>
//             </div>
//           );
//         },
//       },
//       {
//         title: 'Do something else',
//         description: 'another thing',
//         // eslint-disable-next-line react/display-name
//         component: ({ panel }) => {
//           return (
//             <div>
//               DO THING TWO. Panel: <pre>{JSON.stringify(panel.targets)}</pre>
//             </div>
//           );
//         },
//       },
//     ];
//   },
// };
// In Grafana 8.1, this can be improved and moved to `@grafana/runtime`
// NOTE: This is an internal/experimental API/hack and will change!
// (window as any).grafanaPanelInspectActionSupplier = dummySupplier;
import React from 'react';
export var InspectActionsTab = function (_a) {
    var panel = _a.panel, data = _a.data;
    var supplier = window.grafanaPanelInspectActionSupplier;
    if (!supplier) {
        return React.createElement("div", null, "Missing actions");
    }
    var actions = supplier.getActions(panel);
    if (!(actions === null || actions === void 0 ? void 0 : actions.length)) {
        return React.createElement("div", null, "No actions avaliable");
    }
    return (React.createElement("div", null, actions.map(function (a, idx) { return (React.createElement("div", { key: idx },
        React.createElement("h2", null, a.title),
        React.createElement("span", null, a.description),
        React.createElement(a.component, { panel: panel, data: data }))); })));
};
//# sourceMappingURL=PanelInspectActions.js.map