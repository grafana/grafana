/** Import from a lazy editor module so these helpers do not load CodeMirror during application startup. */
export { createCodeEditorTheme } from './components/CodeMirror/theme';
export { signatureHelp } from './components/CodeMirror/signatureHelp';
export { applyVariableReference, createVariableCompletionSource } from './components/CodeMirror/variableCompletion';
export { getQueryFieldConfig } from './components/QueryFieldConfig/queryFieldConfig';
export type { QueryFieldConfig, QueryFieldConfigOptions } from './components/QueryFieldConfig/queryFieldConfig';
