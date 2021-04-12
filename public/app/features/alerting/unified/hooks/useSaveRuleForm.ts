import { RuleFormType, RuleFormValues } from '../types/rule-form';
import { arrayToRecord } from '../utils/misc';
import { useAsyncCallback } from 'react-async-hook';
import { fetchRulerRulesGroup, fetchRulerRulesNamespace, setRulerRuleGroup } from '../api/ruler';
import { RulerAlertingRuleDTO, RulerGrafanaRuleDTO, RulerRuleGroupDTO } from 'app/types/unified-alerting-dto';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { describeInterval } from '@grafana/data/src/datetime/rangeutil';

function formValuesToRulerAlertingRuleDTO(values: RuleFormValues): RulerAlertingRuleDTO {
  const { name, expression, forTime, forTimeUnit } = values;
  return {
    alert: name,
    for: `${forTime}${forTimeUnit}`,
    annotations: arrayToRecord(values.annotations || []),
    labels: arrayToRecord(values.labels || []),
    expr: expression,
  };
}

function intervalToSeconds(interval: string): number {
  const { sec, count } = describeInterval(interval);
  return sec * count;
}

function formValuesToRulerGrafanaRuleDTO(values: RuleFormValues): RulerGrafanaRuleDTO {
  const { name, condition, noDataState, execErrState, evaluateFor, queries } = values;
  if (condition) {
    return {
      grafana_alert: {
        title: name,
        condition,
        for: intervalToSeconds(evaluateFor), // @TODO provide raw string once backend supports it
        no_data_state: noDataState,
        exec_err_state: execErrState,
        data: queries,
        annotations: arrayToRecord(values.annotations || []),
        labels: arrayToRecord(values.labels || []),
      },
    };
  }
  throw new Error('Cannot create rule without specifying alert condition');
}

async function saveLotexRule(values: RuleFormValues): Promise<void> {
  const { dataSourceName, location } = values;
  if (dataSourceName && location) {
    const existingGroup = await fetchRulerRulesGroup(dataSourceName, location.namespace, location.group);
    const rule = formValuesToRulerAlertingRuleDTO(values);

    // @TODO handle "update" case
    const payload: RulerRuleGroupDTO = existingGroup
      ? {
          ...existingGroup,
          rules: [...existingGroup.rules, rule],
        }
      : {
          name: location.group,
          rules: [rule],
        };

    await setRulerRuleGroup(dataSourceName, location.namespace, payload);
  } else {
    throw new Error('Data source and location must be specified');
  }
}

async function saveGrafanaRule(values: RuleFormValues): Promise<void> {
  const { folder, evaluateEvery } = values;
  if (folder) {
    const existingNamespace = await fetchRulerRulesNamespace(GRAFANA_RULES_SOURCE_NAME, folder.title);

    let group = 'rule-1';
    let idx = 1;
    while (!!existingNamespace.find((g) => g.name === group)) {
      group = `rule-${++idx}`;
    }

    const rule = formValuesToRulerGrafanaRuleDTO(values);

    const payload: RulerRuleGroupDTO = {
      name: group,
      interval: evaluateEvery,
      rules: [rule],
    };
    await setRulerRuleGroup(GRAFANA_RULES_SOURCE_NAME, folder.title, payload);
  } else {
    throw new Error('Folder must be specified');
  }
}

export function useSaveRuleForm() {
  return useAsyncCallback(async (values: RuleFormValues) => {
    console.log('submitting', values);
    const { type } = values;
    // in case of system (cortex/loki)
    if (type === RuleFormType.system) {
      await saveLotexRule(values);

      // in case of grafana managed
    } else if (type === RuleFormType.threshold) {
      await saveGrafanaRule(values);
    } else {
      throw new Error('Unexpected rule form type');
    }
  });
}
