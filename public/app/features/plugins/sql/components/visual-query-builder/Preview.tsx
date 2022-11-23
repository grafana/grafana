import { css } from '@emotion/css';
import React from 'react';
import { useCopyToClipboard } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { CodeEditor, Field, IconButton, useStyles2 } from '@grafana/ui';

import { formatSQL } from '../../utils/formatSQL';

type PreviewProps = {
  rawSql: string;
};

export function Preview({ rawSql }: PreviewProps) {
  // TODO: use zero index to give feedback about copy success
  const [_, copyToClipboard] = useCopyToClipboard();
  const styles = useStyles2(getStyles);

  const labelElement = (
    <div className={styles.labelWrapper}>
      <span className={styles.label}>Preview</span>
      <IconButton tooltip="Copy to clipboard" onClick={() => copyToClipboard(rawSql)} name="copy" />
    </div>
  );

  return (
    <Field label={labelElement} className={styles.grow}>
      <CodeEditor
        language="sql"
        height={80}
        value={formatSQL(rawSql)}
        monacoOptions={{ scrollbar: { vertical: 'hidden' }, scrollBeyondLastLine: false }}
        readOnly={true}
        showMiniMap={false}
      />
    </Field>
  );
}

function getStyles(theme: GrafanaTheme2) {
  return {
    grow: css({ flexGrow: 1 }),
    label: css({ fontSize: 12, fontWeight: theme.typography.fontWeightMedium }),
    labelWrapper: css({ display: 'flex', justifyContent: 'space-between', paddingBottom: theme.spacing(0.5) }),
  };
}
