import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Box, InlineSwitch, Stack, useStyles2, useTheme2 } from '@grafana/ui';

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
    <Stack alignItems="center" minHeight={theme.components.height.md} data-testid={FOOTER_TEST_ID}>
      {/* Side tracks of equal width, so the pagination centres on the footer rather than on
          the space the line numbers switch leaves. */}
      <Box flex="1 1 0" />
      {pagination}
      <Stack flex="1 1 0" justifyContent="flex-end" alignItems="center">
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
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  lineNumbers: css({
    fontSize: theme.typography.size.sm,
  }),
});
