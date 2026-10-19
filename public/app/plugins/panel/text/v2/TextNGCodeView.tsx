import { css } from '@emotion/css';
import { lazy, Suspense } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { useStyles2 } from '@grafana/ui';

import { type CodeLanguage } from '../panelcfg.gen';

const TextNGCodeViewImplementation = lazy(() =>
  import('./TextNGCodeViewImplementation').then((module) => ({ default: module.TextNGCodeViewImplementation }))
);

export interface TextNGCodeViewProps {
  content: string;
  language?: CodeLanguage;
  showLineNumbers: boolean;
  /** CSS height passed straight to CodeMirror. Defaults to filling the parent. */
  height?: string;
  transparent?: boolean;
}

/** Read-only code stays visible while its editor and theme load. */
export function TextNGCodeView(props: TextNGCodeViewProps) {
  const styles = useStyles2(getStyles, props.transparent);
  const loadingFallback = <pre className={styles.loadingFallback}>{props.content}</pre>;

  return (
    <Suspense fallback={loadingFallback}>
      <TextNGCodeViewImplementation {...props} loadingFallback={loadingFallback} />
    </Suspense>
  );
}

const getStyles = (theme: GrafanaTheme2, transparent?: boolean) => ({
  // Mirrors the CodeMirror theme
  loadingFallback: css({
    margin: 0,
    padding: '4px 2px 4px 6px',
    height: '100%',
    overflow: 'auto',
    fontFamily: theme.typography.fontFamilyMonospace,
    fontSize: theme.typography.code.fontSize,
    lineHeight: theme.typography.code.lineHeight,
    color: theme.components.input.text,
    backgroundColor: transparent ? 'transparent' : theme.components.input.background,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  }),
});
