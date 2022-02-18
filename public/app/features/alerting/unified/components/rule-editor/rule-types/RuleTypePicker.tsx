import { Stack } from '@grafana/experimental';
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
    <Stack direction="row">
      <GrafanaManagedRuleType selected={selected === RuleFormType.grafana} onClick={onChange} />
      <PrometheusFlavoredType selected={selected === RuleFormType.cloudAlerting} onClick={onChange} />
      <RecordingRuleType selected={selected === RuleFormType.cloudRecording} onClick={onChange} />
    </Stack>
  );
};

export { RuleTypePicker };
