import { lazy, memo, Suspense } from 'react';

import { t } from '@grafana/i18n';
import { ErrorBoundaryAlert, LoadingPlaceholder } from '@grafana/ui';
import { loadCodeMirrorSetup } from '@grafana/ui/internal';
import { type CodeMirrorEditorProps } from '@grafana/ui/unstable';

export type CoreCodeMirrorEditorProps = CodeMirrorEditorProps;

const Editor = lazy(async () => {
  const [useCodeMirrorSetup, { default: CodeMirror }] = await Promise.all([
    loadCodeMirrorSetup(),
    import(/* webpackChunkName: "core-codemirror-editor" */ '@uiw/react-codemirror'),
  ]);

  return {
    default: memo(function CoreCodeMirrorEditorImplementation(props: CoreCodeMirrorEditorProps) {
      const { ref, props: editorProps, languageAlert } = useCodeMirrorSetup(props);

      return (
        <>
          {languageAlert}
          <CodeMirror ref={ref} {...editorProps} />
        </>
      );
    }),
  };
});

/**
 * Grafana's CodeMirror editor for core features that pass raw CodeMirror
 * extensions or theme extensions. Plugins bundle their own copy of CodeMirror,
 * and extensions built with it don't work in Grafana's editor, so the public
 * `CodeMirrorEditor` is moving to declarative props. Core editors that need more
 * than those props use this one.
 */
export function CoreCodeMirrorEditor({ loadingFallback, ...props }: CoreCodeMirrorEditorProps) {
  return (
    <ErrorBoundaryAlert
      boundaryName="CoreCodeMirrorEditor"
      title={t('code-mirror-editor.error-title', 'Code editor failed to load')}
      style="page"
    >
      <Suspense
        fallback={loadingFallback ?? <LoadingPlaceholder text={t('code-mirror-editor.loading', 'Loading editor')} />}
      >
        <Editor {...props} />
      </Suspense>
    </ErrorBoundaryAlert>
  );
}
