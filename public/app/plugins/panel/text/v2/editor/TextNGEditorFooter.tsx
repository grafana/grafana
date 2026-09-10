import { css } from '@emotion/css';
import { type ReactNode } from 'react';

import { type GrafanaTheme2 } from '@grafana/data';
import { t } from '@grafana/i18n';
import { InlineSwitch, useStyles2 } from '@grafana/ui';

import { TextNGFooter } from '../TextNGFooter';

export interface TextNGEditorFooterProps {
  showLineNumbersSwitch: boolean;
  showLineNumbers: boolean;
  onShowLineNumbersChange: (showLineNumbers: boolean) => void;
  frameSelector?: ReactNode;
  pagination?: ReactNode;
}

export function TextNGEditorFooter({
  showLineNumbersSwitch,
  showLineNumbers,
  onShowLineNumbersChange,
  frameSelector,
  pagination,
}: TextNGEditorFooterProps) {
  const styles = useStyles2(getStyles);

  return (
    <TextNGFooter
      left={frameSelector}
      center={pagination}
      right={
        showLineNumbersSwitch && (
          <InlineSwitch
            className={styles.lineNumbers}
            showLabel
            transparent
            label={t('textng.editor.footer-line-numbers', 'Line numbers')}
            value={showLineNumbers}
            onChange={() => onShowLineNumbersChange(!showLineNumbers)}
          />
        )
      }
    />
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  lineNumbers: css({
    fontSize: theme.typography.size.sm,
  }),
});
