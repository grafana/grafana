import { css, cx } from '@emotion/css';
import { useMemo } from 'react';
import { useAsyncFn } from 'react-use';

import { GrafanaTheme2, SelectableValue, toOption } from '@grafana/data';
import { AccessoryButton, InputGroup } from '@grafana/plugin-ui';
import { Alert, Select, useStyles2 } from '@grafana/ui';

import { CloudWatchDatasource } from '../../../datasource';
import { useDimensionKeys, useEnsureVariableHasSingleSelection } from '../../../hooks';
import { Dimensions, MetricStat } from '../../../types';
import { appendTemplateVariables } from '../../../utils/utils';

import { DimensionFilterCondition } from './Dimensions';

export interface Props {
  metricStat: MetricStat;
  datasource: CloudWatchDatasource;
  filter: DimensionFilterCondition;
  disableExpressions: boolean;
  onChange: (value: DimensionFilterCondition) => void;
  onDelete: () => void;
}

const wildcardOption = { value: '*', label: '*' };

const excludeCurrentKey = (dimensions: Dimensions, currentKey: string | undefined) =>
  Object.entries(dimensions ?? {}).reduce<Dimensions>((acc, [key, value]) => {
    if (key !== currentKey) {
      return { ...acc, [key]: value };
    }
    return acc;
  }, {});

export const FilterItem = ({ filter, metricStat, datasource, disableExpressions, onChange, onDelete }: Props) => {
  const { region, namespace, metricName, dimensions, accountId } = metricStat;
  const error = useEnsureVariableHasSingleSelection(datasource, filter.key);
  const dimensionsExcludingCurrentKey = useMemo(
    () => excludeCurrentKey(dimensions ?? {}, filter.key),
    [dimensions, filter]
  );
  const dimensionKeys = useDimensionKeys(datasource, {
    ...metricStat,
    dimensionFilters: dimensionsExcludingCurrentKey,
  });

  const loadDimensionValues = async () => {
    if (!filter.key) {
      return [];
    }

    return datasource.resources
      .getDimensionValues({
        dimensionKey: filter.key,
        dimensionFilters: dimensionsExcludingCurrentKey,
        region,
        namespace,
        metricName,
        accountId,
      })
      .then((result: Array<SelectableValue<string>>) => {
        if (result.length && !disableExpressions && !result.some((o) => o.value === wildcardOption.value)) {
          result.unshift(wildcardOption);
        }
        return appendTemplateVariables(datasource, result);
      });
  };

  const [state, loadOptions] = useAsyncFn(loadDimensionValues, [
    filter.key,
    dimensions,
    region,
    namespace,
    metricName,
    accountId,
  ]);
  const styles = useStyles2(getOperatorStyles);

  return (
    <div className={styles.container} data-testid="cloudwatch-dimensions-filter-item">
      <InputGroup>
        <Select
          aria-label="Dimensions filter key"
          inputId="cloudwatch-dimensions-filter-item-key"
          width="auto"
          value={filter.key ? toOption(filter.key) : null}
          allowCustomValue
          options={dimensionKeys}
          onChange={(change) => {
            if (change.label) {
              onChange({ key: change.label, value: undefined });
            }
          }}
        />

        <span className={cx(styles.root)}>=</span>

        <Select
          aria-label="Dimensions filter value"
          inputId="cloudwatch-dimensions-filter-item-value"
          onOpenMenu={loadOptions}
          width="auto"
          value={filter.value ? toOption(filter.value) : null}
          allowCustomValue
          isLoading={state.loading}
          options={state.value}
          onChange={(change) => {
            if (change.value) {
              onChange({ ...filter, value: change.value });
            }
          }}
        />
        <AccessoryButton aria-label="remove" icon="times" variant="secondary" onClick={onDelete} type="button" />
      </InputGroup>
      {error && <Alert className={styles.alert} title={error} severity="error" topSpacing={1} />}
    </div>
  );
};

const getOperatorStyles = (theme: GrafanaTheme2) => ({
  root: css({
    padding: theme.spacing(0, 1),
    alignSelf: 'center',
  }),
  container: css({ display: 'inline-block' }),
  alert: css({ minWidth: '100%', width: 'min-content' }),
});
