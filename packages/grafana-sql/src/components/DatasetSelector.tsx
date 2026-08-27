import { useAsync } from 'react-use';

import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { type DB, type ResourceSelectorProps, toOption } from '../types';

export interface DatasetSelectorProps extends ResourceSelectorProps {
  db: DB;
  dataset: string | undefined;
  database: string | undefined;
  preconfiguredDataset: string;
  onChange: (v: SelectableValue) => void;
  inputId?: string | undefined;
}

export const DatasetSelector = ({
  dataset,
  database,
  db,
  onChange,
  inputId,
  preconfiguredDataset,
}: DatasetSelectorProps) => {
  /*
    The behavior of this component is based on whether the user chose to create a datasource
    with or without a default database (preconfiguredDataset). If the user configured a default database,
    this selector should only allow that single preconfigured database option to be selected.
    If the user chose to NOT assign/configure a default database, then the user should be able to
    use this component to choose between multiple databases available to the datasource.
  */
  const hasPreconfigCondition = !!preconfiguredDataset;

  const state = useAsync(async () => {
    if (hasPreconfigCondition) {
      return [toOption(preconfiguredDataset)];
    }

    const datasets = await db.datasets(database);
    return datasets.map(toOption);
  }, [database]);

  return (
    <Select
      aria-label={t('grafana-sql.components.dataset-selector.aria-label-dataset-selector', 'Dataset selector')}
      inputId={inputId}
      value={dataset ?? null}
      options={state.value}
      onChange={onChange}
      disabled={state.loading}
      isLoading={state.loading}
      menuShouldPortal={true}
      isClearable={true}
    />
  );
};
