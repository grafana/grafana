import { Rule } from 'app/types/unified-alerting';
import React from 'react';
import { isAlertingRule } from '../../utils/rules';
import { DetailsField } from '../DetailsField';
import { AlertInstancesTable } from './AlertInstancesTable';

type Props = {
  promRule?: Rule;
};

export function RuleDetailsMatchingInstances(props: Props): JSX.Element | null {
  const { promRule } = props;

  if (!isAlertingRule(promRule) || !promRule.alerts?.length) {
    return null;
  }

  return (
    <DetailsField label="Matching instances" horizontal={true}>
      <AlertInstancesTable instances={promRule.alerts} />
    </DetailsField>
  );
}
