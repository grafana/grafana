/**
 * Loads `useCodeMirrorSetup` and the `@uiw/react-codemirror` component it configures,
 * on demand. `@grafana/ui/internal` is imported by eagerly loaded core code, so it
 * exports this loader instead of the hook to keep CodeMirror out of those chunks.
 */
export const loadCodeMirrorSetup = () =>
  Promise.all([import('./useCodeMirrorSetup'), import('@uiw/react-codemirror')]).then(([setup, codeMirror]) => ({
    useCodeMirrorSetup: setup.useCodeMirrorSetup,
    CodeMirror: codeMirror.default,
  }));
