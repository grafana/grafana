import { css, cx } from '@emotion/css';
import { noop } from 'lodash';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { ClipboardButton, useStyles2 } from '@grafana/ui';
import { CodeMirrorEditor } from '@grafana/ui/unstable';

interface Props {
  code: string;
  copyCode?: boolean;
}

export const CodeBlock = ({ code, copyCode = true }: Props) => {
  const lineCount = code.split('\n').length;
  const useMinHeight = lineCount * 24 <= 42; // 24px per line, 42px minimum
  const styles = useStyles2(getStyles);

  return (
    <div className={cx(styles.container, useMinHeight && styles.minHeight)}>
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
      <CodeMirrorEditor
        value={code}
        language="ini"
        aria-label={t('provisioning.code-block.aria-label-code', 'Code example')}
        onChange={noop}
        basicSetup={{ lineNumbers: false, foldGutter: false, highlightActiveLine: false }}
        indentWithTab={false}
        height={useMinHeight ? '42px' : `${Math.min(lineCount * 24, 300)}px`}
        readOnly={true}
      />
    </div>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  container: css({
    position: 'relative',
    margin: `${theme.spacing(2)} 0`,
    border: `1px solid ${theme.colors.border.medium}`,
    '& .cm-scroller': {
      overflowX: 'auto',
      overflowY: 'auto',
    },
  }),
  minHeight: css({
    '& .cm-scroller': {
      overflowY: 'hidden',
    },
  }),
  copyButton: css({
    position: 'absolute',
    top: theme.spacing(1),
    right: theme.spacing(1),
    zIndex: 1,
  }),
});
