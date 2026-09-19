import { useAsync } from 'react-use';

import { type SelectableValue, toOption } from '@grafana/data';
import { t } from '@grafana/i18n';
import { Select } from '@grafana/ui';

import { type DB, type ResourceSelectorProps } from '../types';

export interface DatabaseSelectorProps extends ResourceSelectorProps {
  db: DB;
  database: string | undefined;
  onChange: (v: SelectableValue) => void;
  inputId?: string | undefined;
}

export const DatabaseSelector = ({ db, database, onChange, inputId }: DatabaseSelectorProps) => {
  const state = useAsync(async () => {
    if (!db.databases) {
      return [];
    }
    const databases = await db.databases();
    return databases.map(toOption);
  }, []);

  return (
    <Select
      aria-label={t('grafana-sql.components.database-selector.aria-label-database-selector', 'Database selector')}
      inputId={inputId}
      value={database ?? null}
      options={state.value}
      onChange={onChange}
      disabled={state.loading}
      isLoading={state.loading}
      menuShouldPortal={true}
      isClearable={true}
      allowCustomValue={true}
      placeholder={t('grafana-sql.components.database-selector.placeholder-default', 'Default')}
    />
  );
};
