import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { FC } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Stack } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';

import { useRulesSourcesWithRuler } from '../../../hooks/useRuleSourcesWithRuler';
import { RuleFormType } from '../../../types/rule-form';

import { GrafanaManagedRuleType } from './GrafanaManagedAlert';
import { MimirFlavoredType } from './MimirOrLokiAlert';
import { RecordingRuleType } from './MimirOrLokiRecordingRule';
import { TemplatedAlertRuleType } from './TemplatedAlert';

interface RuleTypePickerProps {
  onChange: (value: RuleFormType) => void;
  selected: RuleFormType;
  enabledTypes: RuleFormType[];
}

const RuleTypePicker: FC<RuleTypePickerProps> = ({ selected, onChange, enabledTypes }) => {
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();
  const hasLotexDatasources = !isEmpty(rulesSourcesWithRuler);
  // @PERCONA
  // Simplified conditions by adding these two consts below
  const showTemplateRuleDisclaimer = enabledTypes.includes(RuleFormType.templated);
  const showGrafanaManagedRuleDisclaimer = !showTemplateRuleDisclaimer && enabledTypes.includes(RuleFormType.grafana);
  const styles = useStyles2(getStyles);

  return (
    <>
      <Stack direction="row" gap={2}>
        {/* @PERCONA */}
        {enabledTypes.includes(RuleFormType.templated) && (
          <TemplatedAlertRuleType selected={selected === RuleFormType.templated} onClick={onChange} />
        )}
        {enabledTypes.includes(RuleFormType.grafana) && (
          <GrafanaManagedRuleType selected={selected === RuleFormType.grafana} onClick={onChange} />
        )}
        {enabledTypes.includes(RuleFormType.cloudAlerting) && (
          <MimirFlavoredType
            selected={selected === RuleFormType.cloudAlerting}
            onClick={onChange}
            disabled={!hasLotexDatasources}
          />
        )}
        {enabledTypes.includes(RuleFormType.cloudRecording) && (
          <RecordingRuleType
            selected={selected === RuleFormType.cloudRecording}
            onClick={onChange}
            disabled={!hasLotexDatasources}
          />
        )}
      </Stack>
      {showTemplateRuleDisclaimer && (
        <small className={styles.meta}>Select &ldquo;Percona templated&rdquo; for an easier alert rule setup.</small>
      )}
      {/* First condition shouldn't occur, just a safety measure */}
      {!showTemplateRuleDisclaimer && showGrafanaManagedRuleDisclaimer && (
        <small className={styles.meta}>
          Select &ldquo;Grafana managed&rdquo; unless you have a Mimir, Loki or Cortex data source with the Ruler API
          enabled.
        </small>
      )}
    </>
  );
};

const getStyles = (theme: GrafanaTheme2) => ({
  meta: css`
    color: ${theme.colors.text.disabled};
  `,
});

export { RuleTypePicker };
