import { Trans } from '../../../../../../core/internationalization';
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
      image="public/img/grafana_icon.svg"
      selected={selected}
      disabled={disabled}
      value={RuleFormType.grafana}
      onClick={onClick}
    />
  );
};

export { GrafanaManagedRuleType };
