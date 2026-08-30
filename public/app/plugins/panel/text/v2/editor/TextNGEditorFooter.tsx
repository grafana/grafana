import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineSwitch, Stack, useStyles2, useTheme2 } from '@grafana/ui';

export const FOOTER_TEST_ID = 'TextNGEditor-footer';

export interface TextNGEditorFooterProps {
  showLineNumbers: boolean;
  onShowLineNumbersChange: (showLineNumbers: boolean) => void;
}

export function TextNGEditorFooter({ showLineNumbers, onShowLineNumbersChange }: TextNGEditorFooterProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  return (
    <Stack
      justifyContent="flex-end"
      alignItems="center"
      minHeight={theme.components.height.md}
      data-testid={FOOTER_TEST_ID}
    >
      <InlineSwitch
        className={styles.lineNumbers}
        showLabel
        transparent
        label={t('textng.editor.footer-line-numbers', 'Line numbers')}
        value={showLineNumbers}
        onChange={() => onShowLineNumbersChange(!showLineNumbers)}
      />
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  lineNumbers: css({
    fontSize: theme.typography.size.sm,
  }),
});
