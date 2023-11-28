/**
 * Narrows generic variable editor state down to specific Adhoc variable extended editor state
 */
export function getAdhocVariableEditorState(editorState) {
    if (editorState.extended && 'infoText' in editorState.extended) {
        return editorState.extended;
    }
    return null;
}
/**
 * Narrows generic variable editor state down to specific Datasource variable extended editor state
 */
export function getDatasourceVariableEditorState(editorState) {
    if (editorState.extended && 'dataSourceTypes' in editorState.extended) {
        return editorState.extended;
    }
    return null;
}
/**
 * Narrows generic variable editor state down to specific Query variable extended editor state
 */
export function getQueryVariableEditorState(editorState) {
    if (editorState.extended && 'dataSource' in editorState.extended) {
        return editorState.extended;
    }
    return null;
}
//# sourceMappingURL=selectors.js.map