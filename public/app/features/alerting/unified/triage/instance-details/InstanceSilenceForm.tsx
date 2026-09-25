import { useMemo } from 'react';

import { type Labels } from '@grafana/data';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { getDefaultSilenceFormValues } from 'app/features/alerting/unified/components/silences/utils';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { type RuleReference } from 'app/features/alerting/unified/types/silence-form';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

interface InstanceSilenceFormProps {
  rule: RuleReference;
  instanceLabels: Labels;
  onClose: () => void;
}

export function InstanceSilenceForm({ rule, instanceLabels, onClose }: InstanceSilenceFormProps) {
  const formValues = useMemo(
    () =>
      getDefaultSilenceFormValues({
        matchers: Object.entries(instanceLabels).map(([name, value]) => ({
          name,
          value,
          operator: MatcherOperator.equal,
        })),
      }),
    [instanceLabels]
  );

  return (
    <AlertmanagerProvider accessType="instance">
      <SilencesEditor
        rule={rule}
        formValues={formValues}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        onSilenceCreated={onClose}
        onCancel={onClose}
      />
    </AlertmanagerProvider>
  );
}
