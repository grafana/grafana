import { css } from '@emotion/css';

import { type GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption, Icon, Label, Stack, Tooltip, useStyles2 } from '@grafana/ui';
import { type StaticOptionsOrderType } from 'app/features/variables/query/QueryVariableStaticOptions';

type SortValue = NonNullable<StaticOptionsOrderType>;

const SORT_OPTIONS: Array<ComboboxOption<SortValue>> = [
  { label: 'Before query values', value: 'before' },
  { label: 'After query values', value: 'after' },
  { label: 'Sorted with query values', value: 'sorted' },
];

interface SortSelectorProps {
  value: StaticOptionsOrderType;
  onChange: (value: StaticOptionsOrderType) => void;
}

export function SortSelector({ value, onChange }: SortSelectorProps) {
  const styles = useStyles2(getStyles);
  const selected = SORT_OPTIONS.find((o) => o.value === value) ?? SORT_OPTIONS[0];

  return (
    <div>
      <Stack direction="row" gap={1} alignItems="start">
        <Label>
          {t('dashboard-scene.query-variable-editor-form.label-static-options-sort', 'Static options sort')}
        </Label>
        <Tooltip
          content={t(
            'variables.query-variable-static-options-sort-select.description-values-variable',
            'How to sort static options with query results'
          )}
          placement="top"
        >
          <Icon name="info-circle" size="sm" className={styles.infoIcon} />
        </Tooltip>
      </Stack>
      <Combobox
        options={SORT_OPTIONS}
        value={selected.value}
        onChange={(opt) => onChange(opt.value)}
        width={25}
        data-testid={
          selectors.pages.Dashboard.Settings.Variables.Edit.QueryVariable.queryOptionsStaticOptionsOrderDropdown
        }
      />
    </div>
  );
}

const getStyles = (theme: GrafanaTheme2) => ({
  infoIcon: css({
    color: theme.colors.text.secondary,
    cursor: 'pointer',
  }),
});
