import { css } from '@emotion/css';

import { GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClipboardButton, useStyles2, CodeEditor } from '@grafana/ui';

interface Props {
  code: string;
  copyCode?: boolean;
}

export const CodeBlock = ({ code, copyCode = true }: Props) => {
  const lineCount = code.split('\n').length;
  const useMinHeight = lineCount * 24 <= 42; // 24px per line, 42px minimum
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.container}>
      {copyCode && (
        <ClipboardButton
          aria-label={t('provisioning.code-block.aria-label-copy', 'Copy code to clipboard')}
          className={styles.copyButton}
          variant="secondary"
          size="sm"
          icon="copy"
          getText={() => code}
        />
      )}
      <CodeEditor
        value={code}
        language="ini"
        showLineNumbers={false}
        showMiniMap={false}
        height={useMinHeight ? '42px' : `${Math.min(lineCount * 24, 300)}px`}
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

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    margin: `${theme.spacing(2)} 0`,
    border: `1px solid ${theme.colors.border.medium}`,
  }),
  copyButton: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 1,
  }),
});
