import { CodeMirrorEditor, type CodeMirrorEditorProps } from '@grafana/ui/unstable';

export type CoreCodeMirrorEditorProps = CodeMirrorEditorProps;

/**
 * The CodeMirror editor for core features that pass raw CodeMirror extensions or
 * theme extensions. Plugins bundle their own copy of CodeMirror, and extensions
 * built with it don't work in Grafana's editor, so the public `CodeMirrorEditor`
 * is moving to declarative props. Core editors that need more than those props
 * use this one.
 */
export function CoreCodeMirrorEditor(props: CoreCodeMirrorEditorProps) {
  return <CodeMirrorEditor {...props} />;
}
