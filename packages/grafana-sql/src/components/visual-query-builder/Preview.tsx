import { css } from '@emotion/css';
import { useCopyToClipboard } from 'react-use';

import { GrafanaTheme2 } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { reportInteraction } from '@grafana/runtime';
import { CodeEditor, Field, IconButton, useStyles2 } from '@grafana/ui';

import { formatSQL } from '../../utils/formatSQL';

type PreviewProps = {
  rawSql: string;
  datasourceType?: string;
};

export function Preview({ rawSql, datasourceType }: PreviewProps) {
  // TODO: use zero index to give feedback about copy success
  const [_, copyToClipboard] = useCopyToClipboard();
  const styles = useStyles2(getStyles);

  const copyPreview = (rawSql: string) => {
    copyToClipboard(rawSql);
    reportInteraction('grafana_sql_preview_copied', {
      datasource: datasourceType,
    });
  };

  const labelElement = (
    <div className={styles.labelWrapper}>
      <span className={styles.label}>
        <Trans i18nKey="grafana-sql.components.preview.label-element.preview">Preview</Trans>
      </span>
      <IconButton
        tooltip={t('grafana-sql.components.preview.label-element.tooltip-copy-to-clipboard', 'Copy to clipboard')}
        onClick={() => copyPreview(rawSql)}
        name="copy"
      />
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
