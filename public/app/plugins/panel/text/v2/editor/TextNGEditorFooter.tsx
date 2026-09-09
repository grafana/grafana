import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineSwitch, Stack, useStyles2, useTheme2 } from '@grafana/ui';

export const FOOTER_TEST_ID = 'TextNGEditor-footer';

export interface TextNGEditorFooterProps {
  showLineNumbersSwitch: boolean;
  showLineNumbers: boolean;
  onShowLineNumbersChange: (showLineNumbers: boolean) => void;
  pagination?: ReactNode;
}

export function TextNGEditorFooter({
  showLineNumbersSwitch,
  showLineNumbers,
  onShowLineNumbersChange,
  pagination,
}: TextNGEditorFooterProps) {
  const theme = useTheme2();
  const styles = useStyles2(getStyles);

  return (
    <Stack
      justifyContent="flex-end"
      alignItems="center"
      minHeight={theme.components.height.md}
      data-testid={FOOTER_TEST_ID}
    >
      <Stack grow={1} justifyContent="center" alignItems="center">
        {pagination}
      </Stack>
      {showLineNumbersSwitch && (
        <InlineSwitch
          className={styles.lineNumbers}
          showLabel
          transparent
          label={t('textng.editor.footer-line-numbers', 'Line numbers')}
          value={showLineNumbers}
          onChange={() => onShowLineNumbersChange(!showLineNumbers)}
        />
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  lineNumbers: css({
    fontSize: theme.typography.size.sm,
  }),
});
