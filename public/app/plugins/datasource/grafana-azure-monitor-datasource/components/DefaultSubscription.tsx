import React, { FunctionComponent, useEffect, useReducer } from 'react';

import { SelectableValue } from '@grafana/data';
import { InlineField, Select, Button } from '@grafana/ui';

import { isCredentialsComplete } from '../credentials';
import { selectors } from '../e2e/selectors';
import { AzureCredentials } from '../types';

const LABEL_WIDTH = 18;

interface Props {
  credentials: AzureCredentials;
  getSubscriptions?: () => Promise<SelectableValue[]>;
  onCredentialsChange?: (updatedCredentials: AzureCredentials) => void;
  subscriptions: Array<SelectableValue<string>>;
  onSubscriptionsChange: (receivedSubscriptions: Array<SelectableValue<string>>) => void;
  disabled?: boolean;
}

export const DefaultSubscription: FunctionComponent<Props> = (props: Props) => {
  const { credentials, onCredentialsChange, getSubscriptions, disabled, subscriptions, onSubscriptionsChange } = props;
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
      if (autoSelect && !credentials.defaultSubscriptionId && received.length > 0) {
        // Selecting the default subscription if subscriptions received but no default subscription selected
        onSubscriptionChange(received[0]);
      } else if (credentials.defaultSubscriptionId) {
        const found = received.find((opt) => opt.value === credentials.defaultSubscriptionId);
        if (!found) {
          // Unselecting the default subscription if it isn't found among the received subscriptions
          onSubscriptionChange(undefined);
        }
      }
    }
  };

  const onSubscriptionChange = (selected: SelectableValue<string> | undefined) => {
    if (onCredentialsChange) {
      const updated: AzureCredentials = {
        ...credentials,
        defaultSubscriptionId: selected?.value,
      };
      onCredentialsChange(updated);
    }
  };
  return (
    <>
      <InlineField
        label="Default Subscription"
        labelWidth={LABEL_WIDTH}
        data-testid={selectors.components.configEditor.defaultSubscription.input}
        htmlFor="default-subscription"
      >
        <div className="width-30" style={{ display: 'flex', gap: '4px' }}>
          <Select
            inputId="default-subscription"
            aria-label="Default Subscription"
            value={
              credentials.defaultSubscriptionId
                ? subscriptions.find((opt) => opt.value === credentials.defaultSubscriptionId)
                : undefined
            }
            options={subscriptions}
            onChange={onSubscriptionChange}
            disabled={disabled}
          />
          <Button
            variant="secondary"
            type="button"
            onClick={onLoadSubscriptions}
            disabled={!hasRequiredFields || disabled}
            data-testid={selectors.components.configEditor.loadSubscriptions.button}
          >
            Load Subscriptions
          </Button>
        </div>
      </InlineField>
    </>
  );
};
