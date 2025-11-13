import { css } from '@emotion/css';
import { MouseEvent, useCallback, useEffect, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { VariableValueOption } from '@grafana/scenes';
import { Button, InlineFieldRow, InlineLabel, InteractiveTable, Text, useStyles2 } from '@grafana/ui';

export interface Props {
  options: VariableValueOption[];
  hasMultiProps?: boolean;
}

export const VariableValuesPreview = ({ options, hasMultiProps }: Props) => {
  if (!options.length) {
    return null;
  }

  if (hasMultiProps) {
    return <VariableValuesWithPropsPreview options={options} />;
  }

  return <VariableValuesWithoutPropsPreview options={options} />;
};
VariableValuesPreview.displayName = 'VariableValuesPreview';

function VariableValuesWithPropsPreview({ options }: { options: VariableValueOption[] }) {
  const styles = useStyles2(getStyles);
  const data = options.map((o) => ({ label: String(o.label), value: String(o.value), ...o.properties }));
  const columns = Object.keys(data[0]).map((id) => ({ id, header: id, sortType: 'alphanumeric' as const }));

  return (
    <div className={styles.previewContainer} style={{ gap: '8px' }}>
      <Text variant="bodySmall" weight="medium">
        <Trans i18nKey="dashboard-scene.variable-values-preview.preview-of-values">Preview of values</Trans>
      </Text>
      {/* TODO: pageSize=20 */}
      <InteractiveTable columns={columns} data={data} getRowId={(r) => String(r.value)} pageSize={2} />
    </div>
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
    <div className={styles.previewContainer}>
      <Text variant="bodySmall" weight="medium">
        <Trans i18nKey="dashboard-scene.variable-values-preview.preview-of-values">Preview of values</Trans>
      </Text>
      <InlineFieldRow>
        {previewOptions.map((o, index) => (
          <InlineFieldRow key={`${o.value}-${index}`} className={styles.optionContainer}>
            <InlineLabel data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.General.previewOfValuesOption}>
              <div className={styles.label}>{o.label}</div>
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
    </div>
  );
}
VariableValuesWithoutPropsPreview.displayName = 'VariableValuesWithoutPropsPreview';

function getStyles(theme: GrafanaTheme2) {
  return {
    previewContainer: css({
      display: 'flex',
      flexDirection: 'column',
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
  };
}
