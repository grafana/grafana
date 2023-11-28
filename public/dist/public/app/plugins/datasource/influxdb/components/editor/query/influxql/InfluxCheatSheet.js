import React from 'react';
const CHEAT_SHEET_ITEMS = [
    {
        title: 'Getting started',
        label: 'Start by selecting a measurement and field from the dropdown above. You can then use the tag selector to further narrow your search.',
    },
];
export const InfluxCheatSheet = () => (React.createElement("div", null,
    React.createElement("h2", null, "InfluxDB Cheat Sheet"),
    CHEAT_SHEET_ITEMS.map((item) => (React.createElement("div", { className: "cheat-sheet-item", key: item.title },
        React.createElement("div", { className: "cheat-sheet-item__title" }, item.title),
        React.createElement("div", { className: "cheat-sheet-item__label" }, item.label))))));
//# sourceMappingURL=InfluxCheatSheet.js.map