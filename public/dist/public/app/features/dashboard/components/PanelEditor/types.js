export var PanelEditorTabId;
(function (PanelEditorTabId) {
    PanelEditorTabId["Query"] = "query";
    PanelEditorTabId["Transform"] = "transform";
    PanelEditorTabId["Visualize"] = "visualize";
    PanelEditorTabId["Alert"] = "alert";
})(PanelEditorTabId || (PanelEditorTabId = {}));
export var DisplayMode;
(function (DisplayMode) {
    DisplayMode[DisplayMode["Fill"] = 0] = "Fill";
    DisplayMode[DisplayMode["Fit"] = 1] = "Fit";
    DisplayMode[DisplayMode["Exact"] = 2] = "Exact";
})(DisplayMode || (DisplayMode = {}));
export var PanelEditTableToggle;
(function (PanelEditTableToggle) {
    PanelEditTableToggle[PanelEditTableToggle["Off"] = 0] = "Off";
    PanelEditTableToggle[PanelEditTableToggle["Table"] = 1] = "Table";
})(PanelEditTableToggle || (PanelEditTableToggle = {}));
export var displayModes = [
    { value: DisplayMode.Fill, label: 'Fill', description: 'Use all available space' },
    { value: DisplayMode.Exact, label: 'Actual', description: 'Make same size as on the dashboard' },
];
export var panelEditTableModes = [
    {
        value: PanelEditTableToggle.Off,
        label: 'Visualization',
        description: 'Show using selected visualization',
    },
    { value: PanelEditTableToggle.Table, label: 'Table', description: 'Show raw data in table form' },
];
//# sourceMappingURL=types.js.map