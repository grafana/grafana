import { useEffect, useMemo, useState } from 'react';

import { SelectableValue } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { FieldValidationMessage, MultiSelect } from '@grafana/ui';

import { selectors } from '../../e2e/selectors';
import { AzureMonitorQuery } from '../../types/query';
import { AzureMonitorOption, AzureQueryEditorFieldProps } from '../../types/types';
import { findOptions } from '../../utils/common';
import { Field } from '../shared/Field';

interface SubscriptionFieldProps extends AzureQueryEditorFieldProps {
  onQueryChange: (newQuery: AzureMonitorQuery) => void;
  subscriptions: AzureMonitorOption[];
}

const SubscriptionField = ({ query, subscriptions, variableOptionGroup, onQueryChange }: SubscriptionFieldProps) => {
  const [error, setError] = useState<boolean>(false);
  const [values, setValues] = useState<Array<SelectableValue<string>>>([]);
  const options = useMemo(() => [...subscriptions, variableOptionGroup], [subscriptions, variableOptionGroup]);

  useEffect(() => {
    if (query.subscriptions && query.subscriptions.length > 0) {
      setValues(findOptions([...subscriptions, ...variableOptionGroup.options], query.subscriptions));
      setError(false);
    } else {
      setError(true);
    }
  }, [query.subscriptions, subscriptions, variableOptionGroup.options]);

  const onChange = (change: Array<SelectableValue<string>>) => {
    const containsSelectAll = change.filter((c) => c.value === 'Select all subscriptions');
    if (!change || change.length === 0) {
      setValues([]);
      onQueryChange({
        ...query,
        subscriptions: [],
      });
      setError(true);
    } else if (containsSelectAll.length > 0) {
      const allSubs = subscriptions.map((c) => c.value ?? '').filter((c) => c !== 'Select all subscriptions');
      onQueryChange({
        ...query,
        subscriptions: allSubs,
      });
    } else {
      const newSubs = change.map((c) => c.value ?? '');
      onQueryChange({
        ...query,
        subscriptions: newSubs,
      });
      setValues(findOptions([...subscriptions, ...variableOptionGroup.options], newSubs));
      setError(false);
    }
  };

  return (
    <Field
      label={t('components.subscription-field.label-subscriptions', 'Subscriptions')}
      data-testid={selectors.components.queryEditor.argsQueryEditor.subscriptions.input}
    >
      <>
        <MultiSelect
          isClearable
          value={values}
          inputId="azure-monitor-subscriptions-field"
          onChange={onChange}
          options={options}
          width={38}
        />
        {error ? (
          <FieldValidationMessage>
            <Trans i18nKey="components.subscription-field.validation-subscriptions">
              At least one subscription must be chosen.
            </Trans>
          </FieldValidationMessage>
        ) : null}
      </>
    </Field>
  );
};

export default SubscriptionField;
