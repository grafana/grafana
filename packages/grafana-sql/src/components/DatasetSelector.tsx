import { useEffect, useRef } from 'react';
import { useAsync } from 'react-use';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { type DB, type ResourceSelectorProps, type SQLDialect, toOption } from '../types';

export interface DatasetSelectorProps extends ResourceSelectorProps {
  db: Pick<DB, 'datasets'>;
  mode?: 'select' | 'fixed';
  dataset: string | undefined;
  preconfiguredDataset: string;
  dialect: SQLDialect;
  onChange: (v: SelectableValue) => void;
  inputId?: string | undefined;
}

export const DatasetSelector = ({
  dataset,
  db,
  mode,
  dialect,
  onChange,
  inputId,
  preconfiguredDataset,
}: DatasetSelectorProps) => {
  // An explicit mode decouples dataset selection from the dialect. Otherwise retain
  // the legacy single-database behavior for configured databases and PostgreSQL.
  const hasPreconfigCondition = mode ? mode === 'fixed' : !!preconfiguredDataset || dialect === 'postgres';

  // Callback changes must not repeat a dataset write while the host is still applying it.
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    if (hasPreconfigCondition && dataset !== preconfiguredDataset) {
      onChangeRef.current(toOption(preconfiguredDataset));
    }
  }, [dataset, hasPreconfigCondition, preconfiguredDataset]);

  const state = useAsync(async () => {
    // Fixed datasets do not need to enumerate other databases.
    if (hasPreconfigCondition) {
      return [toOption(preconfiguredDataset)];
    }

    const datasets = await db.datasets();
    return datasets.map(toOption);
  }, [db, hasPreconfigCondition, preconfiguredDataset]);

  return (
    <Select
      aria-label={t('grafana-sql.components.dataset-selector.aria-label-dataset-selector', 'Dataset selector')}
      inputId={inputId}
      value={dataset}
      options={state.value}
      onChange={onChange}
      disabled={state.loading}
      isLoading={state.loading}
      menuShouldPortal={true}
    />
  );
};
