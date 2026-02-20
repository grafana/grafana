import { css } from '@emotion/css';
import { MouseEvent, useCallback, useEffect, useMemo, useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Trans } from '@grafana/i18n';
import { config } from '@grafana/runtime';
import { SceneVariable, VariableValueOption, VariableValueOptionProperties } from '@grafana/scenes';
import { Button, InlineFieldRow, InlineLabel, InteractiveTable, Text, useStyles2 } from '@grafana/ui';
import { ALL_VARIABLE_VALUE } from 'app/features/variables/constants';

export interface VariableValuesPreviewProps {
  options: VariableValueOption[];
  staticOptions: VariableValueOption[];
}

export const useGetAllVariableOptions = (
  variable: SceneVariable
): { options: VariableValueOption[]; staticOptions: VariableValueOption[] } => {
  const state = variable.useState();
  return {
    options:
      'getOptionsForSelect' in variable && typeof variable.getOptionsForSelect === 'function'
        ? variable.getOptionsForSelect(false)
        : 'options' in state
          ? (state.options ?? [])
          : [],
    staticOptions: 'staticOptions' in state && Array.isArray(state.staticOptions) ? state.staticOptions : [],
  };
};

function flattenProperties(properties?: VariableValueOptionProperties, path = ''): Record<string, string> {
  if (properties === undefined) {
    return {};
  }

  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(properties)) {
    const newPath = path ? `${path}.${key}` : key;

    if (typeof value === 'object' && value !== null) {
      Object.assign(result, flattenProperties(value, newPath));
    } else {
      result[sanitizeKey(newPath)] = value; // see https://github.com/TanStack/table/issues/1671
    }
  }

  return result;
}

// Use the first non-static option which is not the "All" option to derive properties
export const useGetPropertiesFromOptions = (
  options: VariableValueOption[],
  staticOptions: VariableValueOption[] = []
) =>
  useMemo(() => {
    const staticValues = new Set(staticOptions?.map((s) => s.value) ?? []);
    const queryOption = options.find((o) => o.value !== ALL_VARIABLE_VALUE && !staticValues.has(o.value));
    const flattened = flattenProperties(queryOption?.properties);
    const keys = Object.keys(flattened).filter((p) => !['text', 'value'].includes(p));
    return ['text', 'value', ...keys];
  }, [options, staticOptions]);

export const VariableValuesPreview = ({ options, staticOptions }: VariableValuesPreviewProps) => {
  const styles = useStyles2(getStyles);
  const properties = useGetPropertiesFromOptions(options, staticOptions);
  const hasOptions = options.length > 0;
  const displayMultiPropsPreview = config.featureToggles.multiPropsVariables && hasOptions && properties.length > 2;

  return (
    <div className={styles.previewContainer} style={{ gap: '8px' }}>
      <Text variant="bodySmall" weight="medium">
        <Trans i18nKey="dashboard-scene.variable-values-preview.preview-of-values" values={{ count: options.length }}>
          Preview of values ({'{{count}}'})
        </Trans>
        {hasOptions && displayMultiPropsPreview && (
          <VariableValuesWithPropsPreview options={options} properties={properties} />
        )}
        {hasOptions && !displayMultiPropsPreview && <VariableValuesWithoutPropsPreview options={options} />}
      </Text>
    </div>
  );
};

function VariableValuesWithPropsPreview({
  options,
  properties,
}: {
  options: VariableValueOption[];
  properties: string[];
}) {
  const styles = useStyles2(getStyles);

  const { data, columns } = useMemo(() => {
    const data = options.map(({ label, value, properties }) => ({
      text: label,
      value,
      ...flattenProperties(properties),
    }));

    return {
      data,
      columns: properties.map((id) => ({
        id,
        header: unsanitizeKey(id), // see https://github.com/TanStack/table/issues/1671
        sortType: 'alphanumeric' as const,
      })),
    };
  }, [options, properties]);

  return (
    <div data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.CustomVariable.previewTable}>
      <InteractiveTable
        className={styles.table}
        columns={columns}
        data={data}
        getRowId={(r) => JSON.stringify(r)}
        pageSize={8}
      />
    </div>
  );
}
const sanitizeKey = (key: string) => key.replace(/\./g, '__dot__');
const unsanitizeKey = (key: string) => key.replace(/__dot__/g, '.');

export function VariableValuesWithoutPropsPreview({ options }: { options: VariableValueOption[] }) {
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
