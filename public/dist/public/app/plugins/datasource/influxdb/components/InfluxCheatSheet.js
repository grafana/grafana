import React from 'react';
var CHEAT_SHEET_ITEMS = [
    {
        title: 'Getting started',
        label: 'Start by selecting a measurement and field from the dropdown above. You can then use the tag selector to further narrow your search.',
    },
];
var InfluxCheatSheet = function (props) { return (React.createElement("div", null,
    React.createElement("h2", null, "InfluxDB Cheat Sheet"),
    CHEAT_SHEET_ITEMS.map(function (item) { return (React.createElement("div", { className: "cheat-sheet-item", key: item.title },
        React.createElement("div", { className: "cheat-sheet-item__title" }, item.title),
        React.createElement("div", { className: "cheat-sheet-item__label" }, item.label))); }))); };
export default InfluxCheatSheet;
//# sourceMappingURL=InfluxCheatSheet.js.map