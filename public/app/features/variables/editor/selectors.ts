import {
  AdHocVariableEditorState,
  DataSourceVariableEditorState,
  QueryVariableEditorState,
  VariableEditorState,
} from './reducer';

/**
 * Narrows generic variable editor state down to specific Adhoc variable extended editor state
 */
export function getAdhocVariableState(editorState: VariableEditorState): AdHocVariableEditorState | null {
  if (editorState.extended && 'dataSources' in editorState.extended) {
    return editorState.extended;
  }

  return null;
}

/**
 * Narrows generic variable editor state down to specific Datasource variable extended editor state
 */
export function getDatasourceVariableState(editorState: VariableEditorState): DataSourceVariableEditorState | null {
  if (editorState.extended && 'dataSourceTypes' in editorState.extended) {
    return editorState.extended;
  }

  return null;
}

/**
 * Narrows generic variable editor state down to specific Query variable extended editor state
 */
export function getQueryVariableState(editorState: VariableEditorState): QueryVariableEditorState | null {
  if (editorState.extended && 'dataSource' in editorState.extended) {
    return editorState.extended;
  }

  return null;
}
