import { HorizontalGroup } from '@grafana/ui';
import React, { FC } from 'react';
import { RuleFormType } from '../../../types/rule-form';
import GrafanaManagedRuleType from './GrafanaManaged';
import PrometheusFlavoredType from './PrometheusFlavor';
import RecordingRuleType from './RecordingRule';

interface RuleTypePickerProps {
  onChange: (value: RuleFormType) => void;
  selected: RuleFormType;
}

const RuleTypePicker: FC<RuleTypePickerProps> = ({ selected, onChange }) => {
  return (
    <HorizontalGroup spacing="md">
      <GrafanaManagedRuleType selected={selected === RuleFormType.grafana} onClick={onChange} />
      <PrometheusFlavoredType selected={selected === RuleFormType.cloudAlerting} onClick={onChange} />
      <RecordingRuleType selected={selected === RuleFormType.cloudRecording} onClick={onChange} />
    </HorizontalGroup>
  );
};

export { RuleTypePicker };
