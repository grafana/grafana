import { useMemo } from 'react';

import type { Labels } from '@grafana/data/types';
import { SilencesEditor } from 'app/features/alerting/unified/components/silences/SilencesEditor';
import { getDefaultSilenceFormValues } from 'app/features/alerting/unified/components/silences/utils';
import { AlertmanagerProvider } from 'app/features/alerting/unified/state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from 'app/features/alerting/unified/utils/datasource';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

interface InstanceSilenceFormProps {
  ruleUid: string;
  instanceLabels: Labels;
  onClose: () => void;
}

export function InstanceSilenceForm({ ruleUid, instanceLabels, onClose }: InstanceSilenceFormProps) {
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
        ruleUid={ruleUid}
        formValues={formValues}
        alertManagerSourceName={GRAFANA_RULES_SOURCE_NAME}
        onSilenceCreated={onClose}
        onCancel={onClose}
      />
    </AlertmanagerProvider>
  );
}
