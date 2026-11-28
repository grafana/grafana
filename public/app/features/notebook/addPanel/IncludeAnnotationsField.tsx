import { Controller, type Control } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox } from '@grafana/ui';

import { type AddPanelFormValues } from './addPanelForm';

interface Props {
  control: Control<AddPanelFormValues>;
  disabled: boolean;
}

export function IncludeAnnotationsField({ control, disabled }: Props) {
  return (
    <Controller
      control={control}
      name="includeAnnotations"
      render={({ field: { value, onChange, ...field } }) => (
        <Checkbox
          {...field}
          id="add-panel-include-annotations"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
          label={t('notebooks.add-panel.include-annotations', 'Include annotations')}
          description={t(
            'notebooks.add-panel.include-annotations-description',
            "Copy the annotations this panel is showing now. They won't update afterwards."
          )}
        />
      )}
    />
  );
}
