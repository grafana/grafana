import { CodeEditor, ClipboardButton, useTheme2 } from '@grafana/ui';
import { css } from '@emotion/css';

interface Props {
  code: string;
  copyCode?: boolean;
}

export const CodeBlockWithCopy = ({ code, copyCode = true }: Props) => {
  const theme = useTheme2();
  const styles = {
    container: css`
      position: relative;
      margin: ${theme.spacing(2)} 0;
      border: 1px solid ${theme.colors.border.medium};
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
        height="200px"
        readOnly={true}
      />
    </div>
  );
};
