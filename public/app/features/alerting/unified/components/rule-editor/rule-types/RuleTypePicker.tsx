import { HorizontalGroup } from '@grafana/ui';
import { isEmpty } from 'lodash';
import React, { FC } from 'react';
import { useRulesSourcesWithRuler } from '../../../hooks/useRuleSourcesWithRuler';
import { RuleFormType } from '../../../types/rule-form';
import { GrafanaManagedRuleType } from './GrafanaManaged';
import { CortexFlavoredType } from './CortexFlavor';
import { RecordingRuleType } from './RecordingRule';

interface RuleTypePickerProps {
  onChange: (value: RuleFormType) => void;
  selected: RuleFormType;
}

const RuleTypePicker: FC<RuleTypePickerProps> = ({ selected, onChange }) => {
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();
  const hasLotexDatasources = !isEmpty(rulesSourcesWithRuler);

  return (
    <HorizontalGroup spacing="md">
      <GrafanaManagedRuleType selected={selected === RuleFormType.grafana} onClick={onChange} />
      <CortexFlavoredType
        selected={selected === RuleFormType.cloudAlerting}
        onClick={onChange}
        disabled={!hasLotexDatasources}
      />
      <RecordingRuleType
        selected={selected === RuleFormType.cloudRecording}
        onClick={onChange}
        disabled={!hasLotexDatasources}
      />
    </HorizontalGroup>
  );
};

export { RuleTypePicker };
