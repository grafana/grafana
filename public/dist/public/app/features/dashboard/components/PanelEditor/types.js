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
export const displayModes = [
    { value: DisplayMode.Fill, label: 'Fill', description: 'Use all available space' },
    { value: DisplayMode.Exact, label: 'Actual', description: 'Make same size as on the dashboard' },
];
export const panelEditTableModes = [
    {
        value: PanelEditTableToggle.Off,
        label: 'Visualization',
        description: 'Show using selected visualization',
    },
    { value: PanelEditTableToggle.Table, label: 'Table', description: 'Show raw data in table form' },
];
export var VisualizationSelectPaneTab;
(function (VisualizationSelectPaneTab) {
    VisualizationSelectPaneTab[VisualizationSelectPaneTab["Visualizations"] = 0] = "Visualizations";
    VisualizationSelectPaneTab[VisualizationSelectPaneTab["LibraryPanels"] = 1] = "LibraryPanels";
    VisualizationSelectPaneTab[VisualizationSelectPaneTab["Suggestions"] = 2] = "Suggestions";
    VisualizationSelectPaneTab[VisualizationSelectPaneTab["Widgets"] = 3] = "Widgets";
})(VisualizationSelectPaneTab || (VisualizationSelectPaneTab = {}));
//# sourceMappingURL=types.js.map