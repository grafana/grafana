import { css } from '@emotion/css';
import React, { useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';

import { GrafanaTheme2 } from '@grafana/data';
import { AccessoryButton } from '@grafana/experimental';
import { FetchError } from '@grafana/runtime';
import { useStyles2 } from '@grafana/ui';

import { TraceqlFilter, TraceqlSearchScope } from '../dataquery.gen';
import { TempoDatasource } from '../datasource';

import SearchField from './SearchField';
import { getFilteredTags } from './utils';

const getStyles = (theme: GrafanaTheme2) => ({
  vertical: css({
    display: 'flex',
    flexDirection: 'column',
    gap: theme.spacing(0.25),
  }),
  horizontal: css({
    display: 'flex',
    flexDirection: 'row',
  }),
  addTag: css({
    marginLeft: theme.spacing(1),
  }),
});

interface Props {
  updateFilter: (f: TraceqlFilter) => void;
  deleteFilter: (f: TraceqlFilter) => void;
  filters: TraceqlFilter[];
  datasource: TempoDatasource;
  setError: (error: FetchError) => void;
  staticTags: Array<string | undefined>;
  isTagsLoading: boolean;
  hideValues?: boolean;
  query: string;
}
const TagsInput = ({
  updateFilter,
  deleteFilter,
  filters,
  datasource,
  setError,
  staticTags,
  isTagsLoading,
  hideValues,
  query,
}: Props) => {
  const styles = useStyles2(getStyles);
  const generateId = () => uuidv4().slice(0, 8);
  const handleOnAdd = useCallback(
    () => updateFilter({ id: generateId(), operator: '=', scope: TraceqlSearchScope.Span }),
    [updateFilter]
  );

  useEffect(() => {
    if (!filters?.length) {
      handleOnAdd();
    }
  }, [filters, handleOnAdd]);

  const getTags = (f: TraceqlFilter) => {
    const tags = datasource.languageProvider.getTags(f.scope);
    return getFilteredTags(tags, staticTags);
  };

  return (
    <div className={styles.vertical}>
      {filters?.map((f, i) => (
        <div className={styles.horizontal} key={f.id}>
          <SearchField
            filter={f}
            datasource={datasource}
            setError={setError}
            updateFilter={updateFilter}
            tags={getTags(f)}
            isTagsLoading={isTagsLoading}
            hideValue={hideValues}
            query={query}
          />
          {(f.tag || f.value || i > 0) && (
            <AccessoryButton
              variant={'secondary'}
              icon={'times'}
              onClick={() => deleteFilter?.(f)}
              tooltip={'Remove tag'}
              aria-label={`remove tag with ID ${f.id}`}
            />
          )}
          {(f.tag || f.value) && i === filters.length - 1 && (
            <span className={styles.addTag}>
              <AccessoryButton variant={'secondary'} icon={'plus'} onClick={handleOnAdd} tooltip={'Add tag'} />
            </span>
          )}
        </div>
      ))}
    </div>
  );
};

export default TagsInput;
