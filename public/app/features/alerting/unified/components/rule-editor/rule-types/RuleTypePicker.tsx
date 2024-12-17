import { css } from '@emotion/css';
import { isEmpty } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data/src';
import { Stack, useStyles2 } from '@grafana/ui';

import { useRulesSourcesWithRuler } from '../../../hooks/useRuleSourcesWithRuler';
import { RuleFormType } from '../../../types/rule-form';

import { GrafanaManagedRuleType } from './GrafanaManagedAlert';
import { MimirFlavoredType } from './MimirOrLokiAlert';
interface RuleTypePickerProps {
  onChange: (value: RuleFormType) => void;
  selected: RuleFormType;
  enabledTypes: RuleFormType[];
}

const RuleTypePicker = ({ selected, onChange, enabledTypes }: RuleTypePickerProps) => {
  const { rulesSourcesWithRuler } = useRulesSourcesWithRuler();
  const hasLotexDatasources = !isEmpty(rulesSourcesWithRuler);

  const styles = useStyles2(getStyles);

  const handleChange = (type: RuleFormType) => {
    onChange(type);
  };

  return (
    <>
      <Stack direction="row" gap={2}>
        {enabledTypes.includes(RuleFormType.grafana) && (
          <GrafanaManagedRuleType selected={selected === RuleFormType.grafana} onClick={handleChange} />
        )}
        {enabledTypes.includes(RuleFormType.cloudAlerting) && (
          <MimirFlavoredType
            selected={selected === RuleFormType.cloudAlerting}
            onClick={handleChange}
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
  meta: css({
    color: theme.colors.text.disabled,
  }),
});

export { RuleTypePicker };
