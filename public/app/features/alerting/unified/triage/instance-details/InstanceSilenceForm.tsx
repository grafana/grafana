import { useMemo } from 'react';

import { type Labels } from '@grafana/data';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { getDefaultSilenceFormValues } from 'app/features/alerting/unified/components/silences/utils';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { type SilenceFormFields } from 'app/features/alerting/unified/types/silence-form';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

interface InstanceSilenceFormProps {
  ruleUid: string;
  instanceLabels: Labels;
  onClose: () => void;
  formValues?: SilenceFormFields;
  onFormValuesChange?: (values: SilenceFormFields) => void;
}

export function InstanceSilenceForm({
  ruleUid,
  instanceLabels,
  onClose,
  formValues,
  onFormValuesChange,
}: InstanceSilenceFormProps) {
  const initialFormValues = useMemo(
    () =>
      formValues ??
      getDefaultSilenceFormValues({
        matchers: Object.entries(instanceLabels).map(([name, value]) => ({
          name,
          value,
          operator: MatcherOperator.equal,
        })),
      }),
    [formValues, instanceLabels]
  );

  return (
    <AlertmanagerProvider accessType="instance">
      <SilencesEditor
        ruleUid={ruleUid}
        formValues={initialFormValues}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        onSilenceCreated={onClose}
        onCancel={onClose}
        onFormValuesChange={onFormValuesChange}
        showCancelButton={false}
      />
    </AlertmanagerProvider>
  );
}
