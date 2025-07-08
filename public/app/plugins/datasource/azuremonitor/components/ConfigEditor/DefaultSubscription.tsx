import { useEffect, useReducer } from 'react';

import { AzureCredentials, isCredentialsComplete } from '@grafana/azure-sdk';
import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { Select, Button, Field } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMonitorDataSourceJsonData } from '../../types/types';

export interface Props {
  options: AzureMonitorDataSourceJsonData;
  credentials: AzureCredentials;
  getSubscriptions?: () => Promise<SelectableValue[]>;
  subscriptions: Array<SelectableValue<string>>;
  onSubscriptionsChange: (receivedSubscriptions: Array<SelectableValue<string>>) => void;
  onSubscriptionChange: (subscriptionId?: string) => void;
  disabled?: boolean;
}

export const DefaultSubscription = (props: Props) => {
  const {
    credentials,
    disabled,
    options,
    subscriptions,
    getSubscriptions,
    onSubscriptionChange,
    onSubscriptionsChange,
  } = props;
  const hasRequiredFields = isCredentialsComplete(credentials);
  const [loadSubscriptionsClicked, onLoadSubscriptions] = useReducer((val) => val + 1, 0);

  useEffect(() => {
    if (!getSubscriptions || !hasRequiredFields) {
      updateSubscriptions([]);
      return;
    }
    let canceled = false;
    getSubscriptions().then((result) => {
      if (!canceled) {
        updateSubscriptions(result, loadSubscriptionsClicked);
      }
    });
    return () => {
      canceled = true;
    };
    // This effect is intended to be called only once initially and on Load Subscriptions click
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadSubscriptionsClicked]);

  const updateSubscriptions = (received: Array<SelectableValue<string>>, autoSelect = false) => {
    onSubscriptionsChange(received);
    if (getSubscriptions) {
      if (autoSelect && !options.subscriptionId && received.length > 0) {
        // Selecting the default subscription if subscriptions received but no default subscription selected
        onChange(received[0]);
      } else if (options.subscriptionId) {
        const found = received.find((opt) => opt.value === options.subscriptionId);
        if (!found) {
          // Unselecting the default subscription if it isn't found among the received subscriptions
          onChange(undefined);
        }
      }
    }
  };

  const onChange = (selected: SelectableValue<string> | undefined) => onSubscriptionChange(selected?.value);

  return (
    <>
      <Field
        label={t('components.default-subscription.label-default-subscription', 'Default Subscription')}
        data-testid={selectors.components.configEditor.defaultSubscription.input}
        htmlFor="default-subscription"
      >
        <div className="width-30" style={{ display: 'flex', gap: '4px' }}>
          <Select
            inputId="default-subscription"
            aria-label={t('components.default-subscription.aria-label-default-subscription', 'Default Subscription')}
            value={
              options.subscriptionId ? subscriptions.find((opt) => opt.value === options.subscriptionId) : undefined
            }
            options={subscriptions}
            onChange={onChange}
            disabled={disabled}
          />
          <Button
            variant="secondary"
            type="button"
            onClick={onLoadSubscriptions}
            disabled={!hasRequiredFields || disabled}
            data-testid={selectors.components.configEditor.loadSubscriptions.button}
          >
            <Trans i18nKey="components.default-subscription.load-subscriptions">Load Subscriptions</Trans>
          </Button>
        </div>
      </Field>
    </>
  );
};
