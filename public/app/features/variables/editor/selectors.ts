import {
  AdHocVariableEditorState,
  DataSourceVariableEditorState,
  QueryVariableEditorState,
  VariableEditorState,
} from './reducer';

/**
 * Narrows generic variable editor state down to specific Adhoc variable extended editor state
 */
export function getAdhocVariableEditorState(editorState: VariableEditorState): AdHocVariableEditorState | null {
  if (editorState.extended && 'infoText' in editorState.extended) {
    return editorState.extended;
  }

  return null;
}

/**
 * Narrows generic variable editor state down to specific Datasource variable extended editor state
 */
export function getDatasourceVariableEditorState(
  editorState: VariableEditorState
): DataSourceVariableEditorState | null {
  if (editorState.extended && 'dataSourceTypes' in editorState.extended) {
    return editorState.extended;
  }

  return null;
}

/**
 * Narrows generic variable editor state down to specific Query variable extended editor state
 */
export function getQueryVariableEditorState(editorState: VariableEditorState): QueryVariableEditorState | null {
  if (editorState.extended && 'dataSource' in editorState.extended) {
    return editorState.extended;
  }

  return null;
}
