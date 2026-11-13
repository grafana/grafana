import { css } from '@emotion/css';
import { Suspense, lazy, useState } from 'react';

import { t } from '@grafana/i18n';
import { ErrorBoundaryAlert, LoadingPlaceholder } from '@grafana/ui';
import {
  CoreCodeMirrorEditor,
  type CoreCodeMirrorEditorProps,
} from 'app/core/components/CodeMirror/CoreCodeMirrorEditor';

const TemplateCodeMirror = lazy(async () => {
  const { goTemplate } = await import('./editor/goTemplate');
  const extensions = [goTemplate()];

  return {
    default: function TemplateCodeMirror(props: CoreCodeMirrorEditorProps) {
      return <CoreCodeMirrorEditor {...props} extensions={extensions} />;
    },
  };
});

interface TemplateEditorProps
  extends Pick<CoreCodeMirrorEditorProps, 'value' | 'onBlur' | 'readOnly' | 'height' | 'aria-label'> {
  width?: number;
  showLineNumbers?: boolean;
}

export function TemplateEditor({ value, width, showLineNumbers = true, ...props }: TemplateEditorProps) {
  const [content, setContent] = useState({ value, draft: value });
  const loadingFallback = <LoadingPlaceholder text={t('common.loading', 'Loading...')} />;

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
        <Suspense fallback={loadingFallback}>
          <TemplateCodeMirror
            {...props}
            loadingFallback={loadingFallback}
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
