import { Trans } from '@grafana/i18n';
import mimirLogoRecordingSvg from 'img/alerting/mimir_logo_recording.svg';

import { RuleFormType } from '../../../types/rule-form';

import { DisabledTooltip } from './DisabledTooltip';
import { RuleType, SharedProps } from './RuleType';

const RecordingRuleType = ({ selected = false, disabled = false, onClick }: SharedProps) => {
  return (
    <DisabledTooltip visible={disabled}>
      <RuleType
        name="Mimir or Loki recording rule"
        description={
          <span>
            <Trans i18nKey="alerting.recording-rule-type.description">
              Precompute expressions.
              <br />
              Should be combined with an alert rule.
            </Trans>
          </span>
        }
        image={mimirLogoRecordingSvg}
        selected={selected}
        disabled={disabled}
        value={RuleFormType.cloudRecording}
        onClick={onClick}
      />
    </DisabledTooltip>
  );
};

export { RecordingRuleType };
