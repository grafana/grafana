import { ReactElement } from 'react';

import { SelectableValue } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { t } from '@grafana/i18n';
import { Field, MultiSelect, Stack } from '@grafana/ui';

export interface DefaultValueEditorProps {
  values: Array<SelectableValue<string>>;
  options?: Array<SelectableValue<string>>;
  onChange: (values: Array<SelectableValue<string>>) => void;
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
        <MultiSelect<string>
          aria-label={t('dashboard-scene.default-value-editor.aria-label', 'Default value')}
          placeholder={t('dashboard-scene.default-value-editor.placeholder', 'Choose default values')}
          options={options}
          value={values}
          onChange={(items) => onChange(items)}
          allowCustomValue
          isClearable
        />
      </Field>
    </Stack>
  );
}
