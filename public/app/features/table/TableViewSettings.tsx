import { css } from '@emotion/css';

import { type DataFrame, FieldType, fieldReducers, ReducerID, type GrafanaTheme2 } from '@grafana/data';
import { isPivotScalar, pivotFieldKey, supportsPivotReducer, type PivotField } from '@grafana/data/internal';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Button, Combobox, Field, RadioButtonGroup, Stack, StatsPicker, Switch, Tag, useStyles2 } from '@grafana/ui';

import { type useTablePivot } from './useTablePivot';
import { type useTableTranspose } from './useTableTranspose';

const sidebar = selectors.components.Panels.Visualization.TableNG.columnsSidebar;

export function TableViewSettings({
  mode,
  onModeChange,
  transpose,
  pivot,
  source,
}: {
  mode: 'table' | 'transpose' | 'pivot';
  onModeChange: (mode: 'table' | 'transpose' | 'pivot') => void;
  transpose: ReturnType<typeof useTableTranspose>;
  pivot: ReturnType<typeof useTablePivot>;
  source?: DataFrame;
}) {
  const styles = useStyles2(getStyles);
  const fields = (source?.fields ?? []).filter(isPivotScalar);
  const options = fields
    .filter((field) => fields.filter((other) => pivotFieldKey(other) === pivotFieldKey(field)).length === 1)
    .map((field) => ({ label: field.state?.displayName ?? field.name, value: pivotFieldKey(field) }));
  const selection = (key: string): PivotField => {
    const field = fields.find((field) => pivotFieldKey(field) === key)!;
    return { name: field.name, labels: field.labels };
  };
  const { draft, setDraft } = pivot;
  const dimensions = (axis: 'rows' | 'columns', label: string) => (
    <div>
      <Field noMargin label={label}>
        <Combobox
          aria-label={t('table.pivot.add-axis-field', 'Add {{axis}} field', { axis: label })}
          data-testid={axis === 'rows' ? sidebar.pivot.rowsField : sidebar.pivot.columnsField}
          value={null}
          placeholder={t('table.pivot.add-field', 'Add field')}
          options={options.filter(
            (option) => ![...draft.rows, ...draft.columns].some((field) => pivotFieldKey(field) === option.value)
          )}
          onChange={(option) => setDraft({ ...draft, [axis]: [...draft[axis], selection(option.value)] })}
        />
      </Field>
      {draft[axis].map((field, index) => (
        <div key={pivotFieldKey(field)} data-testid={sidebar.pivot.dimension(`${axis}:${pivotFieldKey(field)}`)}>
          <Tag
            className={styles.selection}
            name={options.find((option) => option.value === pivotFieldKey(field))?.label ?? field.name}
            showCloseButton
            closeButtonLabel={t('table.pivot.remove-dimension', 'Remove {{axis}} {{field}}', {
              axis: label,
              field: field.name,
            })}
            onClose={() => setDraft({ ...draft, [axis]: draft[axis].filter((_, i) => i !== index) })}
          />
        </div>
      ))}
    </div>
  );
  return (
    <Stack direction="column" gap={1}>
      <Field noMargin label={t('table.pivot.view', 'View')}>
        <RadioButtonGroup
          value={mode}
          data-testid={sidebar.viewModeRadioGroup}
          disabledOptions={transpose.disabledReason ? ['transpose', 'pivot'] : []}
          onChange={onModeChange}
          options={[
            { label: t('table.pivot.table', 'Table'), value: 'table' },
            { label: t('table.pivot.transpose', 'Transpose'), value: 'transpose' },
            { label: t('table.pivot.pivot', 'Pivot'), value: 'pivot' },
          ]}
        />
      </Field>
      {transpose.disabledReason && <div>{transpose.disabledReason}</div>}
      {mode === 'transpose' && (
        <>
          <Field noMargin label={t('grafana-ui.table.transpose-field-settings', 'Apply field settings to')}>
            <RadioButtonGroup
              value={transpose.fieldSettings}
              data-testid={sidebar.fieldSettingsRadioGroup}
              onChange={transpose.onFieldSettingsChange}
              options={[
                { label: t('grafana-ui.table.transpose-rows', 'Rows'), value: 'rows' },
                { label: t('grafana-ui.table.transpose-columns', 'Columns'), value: 'columns' },
              ]}
            />
          </Field>
          {transpose.fieldSettings === 'rows' && (
            <div>
              {t(
                'grafana-ui.table.transpose-disabled-hint',
                'Turn off Transpose to change filters, sorting, or field layout. Apply filters before transposing.'
              )}
            </div>
          )}
        </>
      )}
      {mode === 'pivot' && (
        <>
          {dimensions('rows', t('table.pivot.rows', 'Rows'))}
          {dimensions('columns', t('table.pivot.columns', 'Columns'))}
          <div>
            <Field noMargin label={t('table.pivot.values', 'Values')}>
              <Combobox
                aria-label={t('table.pivot.add-values-field', 'Add Values field')}
                data-testid={sidebar.pivot.valuesField}
                value={null}
                placeholder={t('table.pivot.add-field', 'Add field')}
                options={options}
                onChange={(option) => {
                  const field = fields.find((field) => pivotFieldKey(field) === option.value)!;
                  const reducer = field.type === FieldType.number ? ReducerID.sum : ReducerID.count;
                  setDraft({
                    ...draft,
                    values: [...draft.values, { field: selection(option.value), reducer, footerReducers: [reducer] }],
                  });
                }}
              />
            </Field>
            {draft.values.map((value, index) => {
              const field = fields.find((field) => pivotFieldKey(field) === pivotFieldKey(value.field));
              const update = (next: Partial<typeof value>) =>
                setDraft({
                  ...draft,
                  values: draft.values.map((entry, i) => (i === index ? { ...entry, ...next } : entry)),
                });
              return (
                <div
                  key={index}
                  data-testid={sidebar.pivot.measure(`${pivotFieldKey(value.field)}:${value.reducer}:${index}`)}
                >
                  <Tag
                    className={styles.selection}
                    name={field?.state?.displayName ?? value.field.name}
                    showCloseButton
                    closeButtonLabel={t('table.pivot.remove-value', 'Remove value {{index}}', { index: index + 1 })}
                    onClose={() => setDraft({ ...draft, values: draft.values.filter((_, i) => i !== index) })}
                  />
                  <Field noMargin label={t('table.pivot.summarize', 'Summarize by')}>
                    <StatsPicker
                      aria-label={t('table.pivot.summarize-field', 'Summarize {{field}} {{index}}', {
                        field: value.field.name,
                        index: index + 1,
                      })}
                      stats={[value.reducer]}
                      defaultStat={value.reducer}
                      filterOptions={(reducer) => Boolean(field && supportsPivotReducer(field, reducer.id))}
                      onChange={([reducer]) =>
                        update({
                          reducer,
                          footerReducers:
                            value.footerReducers.length === 1 && value.footerReducers[0] === value.reducer
                              ? [reducer]
                              : value.footerReducers,
                        })
                      }
                    />
                  </Field>
                  {draft.totalRow && (
                    <Field noMargin label={t('table.pivot.footer-calculations', 'Footer calculations')}>
                      <StatsPicker
                        aria-label={t('table.pivot.footer-field', 'Footer calculations {{field}} {{index}}', {
                          field: value.field.name,
                          index: index + 1,
                        })}
                        allowMultiple
                        stats={value.footerReducers}
                        filterOptions={(reducer) => Boolean(field && supportsPivotReducer(field, reducer.id))}
                        onChange={(footerReducers) => update({ footerReducers })}
                      />
                    </Field>
                  )}
                </div>
              );
            })}
          </div>
          <Field noMargin label={t('table.pivot.total-row', 'Grand total row')}>
            <Switch
              data-testid={sidebar.pivot.totalRowSwitch}
              value={draft.totalRow}
              onChange={(event) => setDraft({ ...draft, totalRow: event.currentTarget.checked })}
            />
          </Field>
          <Field noMargin label={t('table.pivot.total-columns', 'Grand total columns')}>
            <Switch
              data-testid={sidebar.pivot.totalColumnsSwitch}
              value={draft.totalColumns}
              onChange={(event) => setDraft({ ...draft, totalColumns: event.currentTarget.checked })}
            />
          </Field>
          {pivot.error && <div role="alert">{pivot.error}</div>}
          <Button
            size="sm"
            disabled={
              Boolean(transpose.disabledReason) ||
              !draft.rows.length ||
              !draft.values.length ||
              draft.values.some((value) => !fieldReducers.getIfExists(value.reducer))
            }
            data-testid={sidebar.pivot.applyButton}
            onClick={pivot.apply}
          >
            {t('table.pivot.apply', 'Apply pivot')}
          </Button>
        </>
      )}
    </Stack>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  selection: css({
    marginTop: theme.spacing(1),
  }),
});
