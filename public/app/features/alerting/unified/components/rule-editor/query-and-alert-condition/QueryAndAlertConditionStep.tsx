import React, { FC } from 'react';
import { useFormContext } from 'react-hook-form';

import { RuleFormType, RuleFormValues } from '../../../types/rule-form';
import { ConditionField } from '../ConditionField';
import { RuleEditorSection } from '../RuleEditorSection';

import { AlertType } from './AlertType';
import { Query } from './Query';

interface Props {
  editingExistingRule: boolean;
}

export const QueryAndAlertConditionStep: FC<Props> = ({ editingExistingRule }) => {
  const { watch } = useFormContext<RuleFormValues>();

  const type = watch('type');
  const isGrafanaManagedType = type === RuleFormType.grafana;

  return (
    <RuleEditorSection stepNo={1} title="Set a query and alert condition">
      <AlertType editingExistingRule={editingExistingRule} />
      {type && <Query />}
      {isGrafanaManagedType && <ConditionField existing={editingExistingRule} />}
    </RuleEditorSection>
  );
};
