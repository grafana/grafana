import { css } from '@emotion/css';
import { isEmpty } from 'lodash';
import React, { useEffect } from 'react';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Stack } from '@grafana/experimental';
import { useStyles2 } from '@grafana/ui';
import { dispatch } from 'app/store/store';

import { useRulesSourcesWithRuler } from '../../../hooks/useRuleSourcesWithRuler';
import { fetchAllPromBuildInfoAction } from '../../../state/actions';
import { RuleFormType } from '../../../types/rule-form';

import { GrafanaManagedRuleType } from './GrafanaManagedAlert';
import { MimirFlavoredType } from './MimirOrLokiAlert';
import { RecordingRuleType } from './MimirOrLokiRecordingRule';

interface RuleTypePickerProps {
  onChange: (value: RuleFormType) => void;
  selected: RuleFormType;
  enabledTypes: RuleFormType[];
}

const RuleTypePicker = ({ selected, onChange, enabledTypes }: RuleTypePickerProps) => {
  const rulesSourcesWithRuler = useRulesSourcesWithRuler();
  const hasLotexDatasources = !isEmpty(rulesSourcesWithRuler);

  useEffect(() => {
    dispatch(fetchAllPromBuildInfoAction());
  }, []);

  const styles = useStyles2(getStyles);

  return (
    <>
      <Stack direction="row" gap={2}>
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
      {enabledTypes.includes(RuleFormType.grafana) && (
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
