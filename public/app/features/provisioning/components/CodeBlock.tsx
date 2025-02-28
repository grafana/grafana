import { CodeEditor, ClipboardButton, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  code: string;
  copyCode?: boolean;
}

export const CodeBlock = ({ code, copyCode = true }: Props) => {
  const theme = useTheme2();

  // Calculate content size
  const lineCount = code.split('\n').length;
  const estimatedHeight = lineCount * 24; // 24px per line
  const minHeight = 42; // Minimum height for one line
  const useMinHeight = estimatedHeight <= minHeight;
  const height = useMinHeight ? `${minHeight}px` : `${Math.min(estimatedHeight, 300)}px`;

  const styles = {
    container: css`
      position: relative;
      margin: ${theme.spacing(2)} 0;
      border: 1px solid ${theme.colors.border.medium};
      min-height: ${minHeight}px;
    `,
    copyButton: css`
      position: absolute;
      top: ${theme.spacing(1)};
      right: ${theme.spacing(1)};
      z-index: 1;
    `,
  };

  return (
    <div className={styles.container}>
      {copyCode && (
        <ClipboardButton className={styles.copyButton} variant="secondary" size="sm" icon="copy" getText={() => code} />
      )}
      <CodeEditor
        value={code}
        language="ini"
        showLineNumbers={false}
        showMiniMap={false}
        height={height}
        readOnly={true}
        monacoOptions={{
          scrollBeyondLastLine: false,
          scrollbar: {
            vertical: useMinHeight ? 'hidden' : 'auto',
            horizontal: 'auto',
          },
        }}
      />
    </div>
  );
};
