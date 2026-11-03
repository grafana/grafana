import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { Field } from '../shared/Field';

interface HealthModelFieldProps {
  healthModels: Array<ComboboxOption<string>>;
  selectedHealthModelResourceId?: string;
  loadingHealthModels: boolean;
  hasSelectedSubscription: boolean;
  onHealthModelChange: (selection: ComboboxOption<string>) => void;
}

const HealthModelField = ({
  healthModels,
  selectedHealthModelResourceId,
  loadingHealthModels,
  hasSelectedSubscription,
  onHealthModelChange,
}: HealthModelFieldProps) => {
  return (
    <Field label={t('components.health-models-query-editor.label-health-model', 'Health Model')} labelWidth={12}>
      <Combobox
        aria-label={t('components.health-models-query-editor.aria-label-health-model', 'Azure Monitor Health Model')}
        options={healthModels}
        noOptionsMessage={t('components.health-models-query-editor.no-health-models-found', 'No health models found')}
        value={selectedHealthModelResourceId}
        onChange={onHealthModelChange}
        loading={loadingHealthModels}
        disabled={!hasSelectedSubscription}
        width={30}
      />
    </Field>
  );
};

export default HealthModelField;
