/**
 * THESE COMPONENTS MUST NOT BE USED EXTERNALLY OR IN PLUGINS.
 *
 * Unstable components are still in development and are subject to breaking changes
 * at any point, like feature flags but for components. They must only be used in
 * Grafana core where we can coordinate changes.
 *
 * Once mature, they will be moved to the main export, be available to plugins, and
 * be subject to the standard policies
 */

export * from './utils/skeleton';

export { CodeMirrorEditor } from './components/CodeMirror/CodeEditorLazy';
export { CodeMirrorDiffEditor } from './components/CodeMirror/DiffEditorLazy';
export { CODE_MIRROR_LANGUAGES } from './components/CodeMirror/languages';
export type {
  CodeMirrorBasicSetup,
  CodeMirrorBasicSetupOptions,
  CodeMirrorCompletion,
  CodeMirrorCompletionContext,
  CodeMirrorCompletionMode,
  CodeMirrorCompletionResult,
  CodeMirrorCompletionSource,
  CodeMirrorDiffEditorProps,
  CodeMirrorEditorLanguage,
  CodeMirrorEditorProps,
  CodeMirrorSqlDialect,
  CodeMirrorStyle,
  CodeMirrorThemeOverrides,
  SignatureHelp,
  SignatureHelpProvider,
  SignatureInformation,
  SignatureParameter,
  VariableCompletionDisplay,
  VariableCompletionOptions,
} from './components/CodeMirror/types';
export { TableNG } from './components/Table/TableNG/TableNG';
export { RangeSliderG14 } from './components/Slider/RangeSliderG14';
export type { RangeSliderG14Props } from './components/Slider/types';
export { usePanelNotices, usePanelStatusSnapshot, PanelStatusActions } from './components/PanelChrome';
export { SanitizedSVG } from './components/SanitizedSVG/SanitizedSVG';
