import { Trans } from '@grafana/i18n';
import grafanaIconSvg from 'img/grafana_icon.svg';

import { RuleFormType } from '../../../types/rule-form';

import { RuleType, SharedProps } from './RuleType';

const GrafanaManagedRuleType = ({ selected = false, disabled, onClick }: SharedProps) => {
  return (
    <RuleType
      name="Grafana managed alert"
      description={
        <span>
          <Trans i18nKey="alerting.grafana-managed-rule-type.description">
            Supports multiple data sources of any kind.
            <br />
            Transform data with expressions.
          </Trans>
        </span>
      }
      image={grafanaIconSvg}
      selected={selected}
      disabled={disabled}
      value={RuleFormType.grafana}
      onClick={onClick}
    />
  );
};

export { GrafanaManagedRuleType };
