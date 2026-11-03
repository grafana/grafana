import { css } from '@emotion/css';
import { Suspense, lazy, useState } from 'react';

import { t } from '@grafana/i18n';
import { ErrorBoundaryAlert, LoadingPlaceholder } from '@grafana/ui';
import { type CodeMirrorEditorProps } from '@grafana/ui/unstable';

const TemplateCodeMirror = lazy(async () => {
  const [{ CodeMirrorEditor }, { goTemplate }] = await Promise.all([
    import('@grafana/ui/unstable'),
    import('./editor/goTemplate'),
  ]);
  const extensions = [goTemplate()];

  return {
    default: function TemplateCodeMirror(props: CodeMirrorEditorProps) {
      return <CodeMirrorEditor {...props} extensions={extensions} />;
    },
  };
});

interface TemplateEditorProps
  extends Pick<CodeMirrorEditorProps, 'value' | 'onBlur' | 'readOnly' | 'height' | 'aria-label'> {
  width?: number;
  showLineNumbers?: boolean;
}

export function TemplateEditor({ value, width, showLineNumbers = true, ...props }: TemplateEditorProps) {
  const [content, setContent] = useState({ value, draft: value });

  if (value !== content.value) {
    setContent({ value, draft: value });
  }

  return (
    <div className={editorContainer} style={{ width }}>
      <ErrorBoundaryAlert
        boundaryName="TemplateEditor"
        title={t('grafana-ui.code-mirror.error-label', 'CodeMirror editor failed to load')}
        style="page"
      >
        <Suspense fallback={<LoadingPlaceholder text={t('common.loading', 'Loading...')} />}>
          <TemplateCodeMirror
            {...props}
            value={content.draft}
            onChange={(draft) => setContent({ value, draft })}
            basicSetup={{ lineNumbers: showLineNumbers, foldGutter: showLineNumbers }}
          />
        </Suspense>
      </ErrorBoundaryAlert>
    </div>
  );
}

const editorContainer = css({
  '.cm-editor': {
    border: 'none',
  },
});
