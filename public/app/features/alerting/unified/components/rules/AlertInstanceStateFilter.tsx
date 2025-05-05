import { css } from '@emotion/css';
import { capitalize } from 'lodash';

import { GrafanaTheme2 } from '@grafana/data';
import { Label, RadioButtonGroup, Tag, useStyles2 } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { GrafanaAlertState, PromAlertingRuleState } from 'app/types/unified-alerting-dto';

export type InstanceStateFilter =
  | GrafanaAlertState
  | PromAlertingRuleState.Pending
  | PromAlertingRuleState.Firing
  | PromAlertingRuleState.Recovering;

interface Props {
  className?: string;
  filterType: 'grafana' | 'prometheus';
  stateFilter?: InstanceStateFilter;
  onStateFilterChange: (value?: InstanceStateFilter) => void;
  itemPerStateStats?: Record<string, number>;
}

export const AlertInstanceStateFilter = ({
  className,
  onStateFilterChange,
  stateFilter,
  filterType,
  itemPerStateStats,
}: Props) => {
  const styles = useStyles2(getStyles);

  const getOptionComponent = (state: InstanceStateFilter) => {
    return function InstanceStateCounter() {
      return itemPerStateStats && itemPerStateStats[state] ? (
        <Tag name={itemPerStateStats[state].toFixed(0)} colorIndex={9} className={styles.tag} />
      ) : null;
    };
  };

  const grafanaOptions = Object.values(GrafanaAlertState).map((state) => ({
    label: state,
    value: state,
    component: getOptionComponent(state),
  }));

  const promOptionValues = [PromAlertingRuleState.Firing, PromAlertingRuleState.Pending] as const;
  const promOptions = promOptionValues.map((state) => ({
    label: capitalize(state),
    value: state,
    component: getOptionComponent(state),
  }));

  const stateOptions = filterType === 'grafana' ? grafanaOptions : promOptions;

  return (
    <div className={className} data-testid="alert-instance-state-filter">
      <Label>
        <Trans i18nKey="alerting.alert-instance-state-filter.state">State</Trans>
      </Label>
      <RadioButtonGroup
        options={stateOptions}
        value={stateFilter}
        onChange={onStateFilterChange}
        onClick={(v) => {
          if (v === stateFilter) {
            onStateFilterChange(undefined);
          }
        }}
      />
    </div>
  );
};

function getStyles(theme: GrafanaTheme2) {
  return {
    tag: css({
      fontSize: '11px',
      fontWeight: 'normal',
      padding: theme.spacing(0.25, 0.5),
      verticalAlign: 'middle',
      marginLeft: theme.spacing(0.5),
    }),
  };
}
