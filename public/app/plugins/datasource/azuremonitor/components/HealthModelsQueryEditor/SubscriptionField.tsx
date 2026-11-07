import { t } from '@grafana/i18n';
import { Combobox, type ComboboxOption } from '@grafana/ui';

import { Field } from '../shared/Field';

interface SubscriptionFieldProps {
  subscriptions: Array<ComboboxOption<string>>;
  selectedSubscription?: string;
  loadingSubscriptions: boolean;
  onSubscriptionChange: (selection: ComboboxOption<string>) => void;
}

const SubscriptionField = ({
  subscriptions,
  selectedSubscription,
  loadingSubscriptions,
  onSubscriptionChange,
}: SubscriptionFieldProps) => {
  return (
    <Field label={t('components.health-models-query-editor.label-subscription', 'Subscription')} labelWidth={12}>
      <Combobox
        aria-label={t(
          'components.health-models-query-editor.aria-label-subscription',
          'Azure Monitor Health Models subscription'
        )}
        options={subscriptions}
        value={selectedSubscription}
        onChange={onSubscriptionChange}
        loading={loadingSubscriptions}
        width={30}
      />
    </Field>
  );
};

export default SubscriptionField;
