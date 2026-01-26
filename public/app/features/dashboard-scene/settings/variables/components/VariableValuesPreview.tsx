import { css } from '@emotion/css';
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { VariableValueOption, VariableValueOptionProperties } from '@grafana/scenes';
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

  const { data, columns } = useMemo(() => {
    const data = options.map(({ label, value, properties }) => ({
      label: String(label),
      value: String(value),
      ...flattenProperties(properties),
    }));

    return {
      data,
      columns: Object.keys(data[0] ?? {}).map((id) => ({
        id,
        // see https://github.com/TanStack/table/issues/1671
        header: unsanitizeKey(id),
        sortType: 'alphanumeric' as const,
      })),
    };
  }, [options]);

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

const sanitizeKey = (key: string) => key.replace(/\./g, '__dot__');
const unsanitizeKey = (key: string) => key.replace(/__dot__/g, '.');

function flattenProperties(properties?: VariableValueOptionProperties, path = ''): Record<string, string> {
  if (properties === undefined) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(properties)) {
    const newPath = path ? `${path}.${key}` : key;

    if (typeof value === 'object') {
      Object.assign(result, flattenProperties(value, newPath));
    } else {
      // see https://github.com/TanStack/table/issues/1671
      result[sanitizeKey(newPath)] = value;
    }
  }

  return result;
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
