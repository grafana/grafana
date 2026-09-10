import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineSwitch, useStyles2 } from '@grafana/ui';

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
  const styles = useStyles2(getStyles);

  return (
    <div className={styles.footer} data-testid={FOOTER_TEST_ID}>
      {pagination && <div className={styles.pagination}>{pagination}</div>}
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
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  footer: css({
    display: 'grid',
    gridTemplateColumns: '1fr auto 1fr',
    alignItems: 'center',
    minHeight: theme.spacing(theme.components.height.md),
  }),
  pagination: css({
    gridColumn: 2,
  }),
  lineNumbers: css({
    gridColumn: 3,
    justifySelf: 'end',
    fontSize: theme.typography.code.fontSize,
  }),
});
