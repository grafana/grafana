import { ReactElement } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { ComboboxOption, Field, MultiCombobox, Stack } from '@grafana/ui';

export interface DefaultValueEditorProps {
  values: Array<ComboboxOption<string>>;
  options?: Array<ComboboxOption<string>>;
  onChange: (values: Array<ComboboxOption<string>>) => void;
}

export function DefaultValueEditor({ values, options = [], onChange }: DefaultValueEditorProps): ReactElement {
  return (
    <Stack
      direction="column"
      gap={1}
      data-testid={selectors.pages.Dashboard.Settings.Variables.Edit.GroupByVariable.defaultValueSection}
    >
      <Field
        label={t('dashboard-scene.default-value-editor.label', 'Default value')}
        description={t('dashboard-scene.default-value-editor.description', 'Values that are pre-selected by default.')}
        noMargin
      >
        <MultiCombobox
          aria-label={t('dashboard-scene.default-value-editor.aria-label', 'Default value')}
          placeholder={t('dashboard-scene.default-value-editor.placeholder', 'Choose default values')}
          options={options}
          value={values}
          onChange={onChange}
          createCustomValue
          isClearable
        />
      </Field>
    </Stack>
  );
}
