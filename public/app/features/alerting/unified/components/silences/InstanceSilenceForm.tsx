import { useMemo } from 'react';

import { type Labels } from '@grafana/data';
import { MatcherOperator } from 'app/plugins/datasource/alertmanager/types';

import { AlertmanagerProvider } from '../../state/AlertmanagerContext';
import { GRAFANA_RULES_SOURCE_NAME } from '../../utils/datasource';
import { isPrivateLabelKey } from '../../utils/labels';

import { SilencesEditor } from './SilencesEditor';
import { getDefaultSilenceFormValues } from './utils';

interface InstanceSilenceFormProps {
  ruleUid: string;
  instanceLabels: Labels;
  onClose: () => void;
}

export function InstanceSilenceForm({ ruleUid, instanceLabels, onClose }: InstanceSilenceFormProps) {
  const formValues = useMemo(
    () =>
      getDefaultSilenceFormValues({
        matchers: Object.entries(instanceLabels)
          .filter(([name]) => !isPrivateLabelKey(name))
          .map(([name, value]) => ({ name, value, operator: MatcherOperator.equal })),
      }),
    [instanceLabels]
  );

  return (
    <AlertmanagerProvider accessType="instance" alertmanagerSourceName={GRAFANA_RULES_SOURCE_NAME}>
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
