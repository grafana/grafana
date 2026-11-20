/**
 * EXTERNAL AND PLUGIN USE IS RESTRICTED TO THE EXCEPTION BELOW.
 *
 * Unstable components are still in development and are subject to breaking changes
 * at any point, like feature flags but for components. They must only be used in
 * Grafana core where we can coordinate changes.
 *
 * Exception: the MCP Apps proof of concept may use TimeRangeSelector with a pinned,
 * bundled @grafana/ui version. API changes require coordinated renderer upgrades;
 * this provides no stable compatibility guarantee.
 *
 * Once mature, they will be moved to the main export, be available to plugins, and
 * be subject to the standard policies
 */

export * from './utils/skeleton';

export { CodeMirrorEditor } from './components/CodeMirror/CodeEditorLazy';
export { CodeMirrorDiffEditor } from './components/CodeMirror/DiffEditorLazy';
export { CODE_MIRROR_LANGUAGES } from './components/CodeMirror/languages';
export { createCodeEditorTheme } from './components/CodeMirror/theme';
export { signatureHelp } from './components/CodeMirror/signatureHelp';
export type { SignatureHelpOptions } from './components/CodeMirror/signatureHelp';
export { applyVariableReference, createVariableCompletionSource } from './components/CodeMirror/variableCompletion';
export type { VariableCompletionDisplay, VariableCompletionOptions } from './components/CodeMirror/variableCompletion';
export type {
  CodeMirrorBasicSetup,
  CodeMirrorCompletion,
  CodeMirrorCompletionContext,
  CodeMirrorCompletionMode,
  CodeMirrorCompletionResult,
  CodeMirrorCompletionSource,
  CodeMirrorDiffEditorProps,
  CodeMirrorEditorLanguage,
  CodeMirrorEditorProps,
  CodeMirrorEditorTheme,
  CodeMirrorExtension,
  CodeMirrorSqlDialect,
  SignatureHelp,
  SignatureHelpProvider,
  SignatureInformation,
  SignatureParameter,
} from './components/CodeMirror/types';
export { TableNG } from './components/Table/TableNG/TableNG';
export { RangeSliderG14 } from './components/Slider/RangeSliderG14';
export type { RangeSliderG14Props } from './components/Slider/types';
export { usePanelNotices, usePanelStatusSnapshot, PanelStatusActions } from './components/PanelChrome';
export { SanitizedSVG } from './components/SanitizedSVG/SanitizedSVG';
export { getTextContentStyles } from './themes/GlobalStyles/textContentStyles';

export { TimeRangeSelector } from './components/DateTimePickers/TimeRangePicker/TimeRangeSelector';
export type { TimeRangeSelectorProps } from './components/DateTimePickers/TimeRangePicker/TimeRangeSelector';
