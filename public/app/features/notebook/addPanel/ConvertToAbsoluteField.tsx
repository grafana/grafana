import { Controller, type Control } from 'react-hook-form';

import { t } from '@grafana/i18n';
import { Checkbox } from '@grafana/ui';

import { type AddPanelFormValues } from './addPanelForm';

interface Props {
  control: Control<AddPanelFormValues>;
  disabled: boolean;
}

export function ConvertToAbsoluteField({ control, disabled }: Props) {
  return (
    <Controller
      control={control}
      name="convertToAbsolute"
      render={({ field: { value, onChange, ...field } }) => (
        <Checkbox
          {...field}
          id="add-panel-convert-to-absolute"
          value={value}
          disabled={disabled}
          onChange={(event) => onChange(event.currentTarget.checked)}
          label={t('notebooks.add-panel.convert-to-absolute', 'Convert to an absolute time range')}
          description={t(
            'notebooks.add-panel.convert-to-absolute-description',
            'Lock to the exact times the relative range covers now.'
          )}
        />
      )}
    />
  );
}
