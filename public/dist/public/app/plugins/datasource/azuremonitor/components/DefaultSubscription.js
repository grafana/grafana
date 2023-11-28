import React, { useEffect, useReducer } from 'react';
import { Select, Button, Field } from '@grafana/ui';
import { isCredentialsComplete } from '../credentials';
import { selectors } from '../e2e/selectors';
export const DefaultSubscription = (props) => {
    const { credentials, disabled, options, subscriptions, getSubscriptions, onSubscriptionChange, onSubscriptionsChange, } = props;
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
    const updateSubscriptions = (received, autoSelect = false) => {
        onSubscriptionsChange(received);
        if (getSubscriptions) {
            if (autoSelect && !options.subscriptionId && received.length > 0) {
                // Selecting the default subscription if subscriptions received but no default subscription selected
                onChange(received[0]);
            }
            else if (options.subscriptionId) {
                const found = received.find((opt) => opt.value === options.subscriptionId);
                if (!found) {
                    // Unselecting the default subscription if it isn't found among the received subscriptions
                    onChange(undefined);
                }
            }
        }
    };
    const onChange = (selected) => onSubscriptionChange(selected === null || selected === void 0 ? void 0 : selected.value);
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, { label: "Default Subscription", "data-testid": selectors.components.configEditor.defaultSubscription.input, htmlFor: "default-subscription" },
            React.createElement("div", { className: "width-30", style: { display: 'flex', gap: '4px' } },
                React.createElement(Select, { inputId: "default-subscription", "aria-label": "Default Subscription", value: options.subscriptionId ? subscriptions.find((opt) => opt.value === options.subscriptionId) : undefined, options: subscriptions, onChange: onChange, disabled: disabled }),
                React.createElement(Button, { variant: "secondary", type: "button", onClick: onLoadSubscriptions, disabled: !hasRequiredFields || disabled, "data-testid": selectors.components.configEditor.loadSubscriptions.button }, "Load Subscriptions")))));
};
//# sourceMappingURL=DefaultSubscription.js.map