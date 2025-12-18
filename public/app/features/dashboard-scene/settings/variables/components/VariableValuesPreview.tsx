import { css } from '@emotion/css';
import { MouseEvent, useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { VariableValueOption } from '@grafana/scenes';
import { Button, InlineFieldRow, InlineLabel, InteractiveTable, Text, useStyles2 } from '@grafana/ui';

export interface Props {
  options: VariableValueOption[];
  hasMultiProps?: boolean;
}

export const VariableValuesPreview = ({ options, hasMultiProps }: Props) => {
  const styles = useStyles2(getStyles);
  const hasOptions = options.length > 0;
  const displayMultiPropsPreview = config.featureToggles.multiPropsVariables && hasMultiProps;

  return (
    <div className={styles.previewContainer} style={{ gap: '8px' }}>
      <Text variant="bodySmall" weight="medium">
        <Trans i18nKey="dashboard-scene.variable-values-preview.preview-of-values" values={{ count: options.length }}>
          Preview of values ({'{{count}}'})
        </Trans>
        {hasOptions && displayMultiPropsPreview && <VariableValuesWithPropsPreview options={options} />}
        {hasOptions && !displayMultiPropsPreview && <VariableValuesWithoutPropsPreview options={options} />}
      </Text>
    </div>
  );
};

function VariableValuesWithPropsPreview({ options }: { options: VariableValueOption[] }) {
  const styles = useStyles2(getStyles);
  const data = options.map((o) => ({ label: String(o.label), value: String(o.value), ...o.properties }));
  // the first item in data may be the "All" option, which does not have any extra properties, so we try the 2nd item to determine the column names
  const columns = Object.keys(data[1] || data[0]).map((id) => ({ id, header: id, sortType: 'alphanumeric' as const }));

  return (
    <InteractiveTable
      className={styles.table}
      columns={columns}
      data={data}
      getRowId={(r) => String(r.value)}
      pageSize={8}
    />
  );
}

function VariableValuesWithoutPropsPreview({ options }: { options: VariableValueOption[] }) {
  const styles = useStyles2(getStyles);
  const [previewLimit, setPreviewLimit] = useState(20);
  const [previewOptions, setPreviewOptions] = useState<VariableValueOption[]>([]);
  const showMoreOptions = useCallback(
    (event: MouseEvent) => {
      event.preventDefault();
      setPreviewLimit(previewLimit + 20);
    },
    [previewLimit, setPreviewLimit]
  );
  useEffect(() => setPreviewOptions(options.slice(0, previewLimit)), [previewLimit, options]);

  return (
    <>
      <InlineFieldRow>
        {previewOptions.map((o, index) => (
          <InlineFieldRow key={`${o.value}-${index}`} className={styles.optionContainer}>
            <InlineLabel data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption}>
              <div className={styles.label}>{o.label || String(o.value)}</div>
            </InlineLabel>
          </InlineFieldRow>
        ))}
      </InlineFieldRow>
      {options.length > previewLimit && (
        <InlineFieldRow className={styles.optionContainer}>
          <Button onClick={showMoreOptions} variant="secondary" size="sm">
            <Trans i18nKey="dashboard-scene.variable-values-preview.show-more">Show more</Trans>
          </Button>
        </InlineFieldRow>
      )}
    </>
  );
}
VariableValuesWithoutPropsPreview.displayName = 'VariableValuesWithoutPropsPreview';

function getStyles(theme: GrafanaTheme2) {
  return {
    previewContainer: css({
      display: 'flex',
      flexDirection: 'column',
      gap: theme.spacing(1),
      marginTop: theme.spacing(2),
    }),
    optionContainer: css({
      marginLeft: theme.spacing(0.5),
      marginBottom: theme.spacing(0.5),
    }),
    label: css({
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      maxWidth: '50vw',
    }),
    table: css({
      td: css({
        padding: theme.spacing(0.5, 1),
      }),
    }),
  };
}
