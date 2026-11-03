import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { AzureHealthModelsQueryType } from '../../dataquery.gen';
import { Field } from '../shared/Field';

const healthModelsQueryTypeOptions: Array<ComboboxOption<AzureHealthModelsQueryType>> = [
  { label: 'Entity Health Snapshot', value: AzureHealthModelsQueryType.EntityHealthSnapshot },
  { label: 'Entity Health History', value: AzureHealthModelsQueryType.EntityHealthHistory },
];

interface HealthModelsQueryTypeFieldProps {
  selectedHealthModelsQueryType?: AzureHealthModelsQueryType;
  disabled: boolean;
  onQueryTypeChange: (selection: ComboboxOption<AzureHealthModelsQueryType>) => void;
}

const HealthModelsQueryTypeField = ({
  selectedHealthModelsQueryType,
  disabled,
  onQueryTypeChange,
}: HealthModelsQueryTypeFieldProps) => {
  return (
    <Field label={t('components.health-models-query-editor.label-type', 'Query type')} labelWidth={12}>
      <Combobox
        aria-label={t(
          'components.health-models-query-editor.aria-label-type',
          'Azure Monitor Health Models query type'
        )}
        options={healthModelsQueryTypeOptions}
        value={selectedHealthModelsQueryType}
        onChange={onQueryTypeChange}
        disabled={disabled}
        width={30}
      />
    </Field>
  );
};

export default HealthModelsQueryTypeField;
