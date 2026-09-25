import { useMemo } from 'react';

import { t } from '@grafana/i18n';
import { type DataQuery } from '@grafana/schema';

import { trackRenameInitiated } from '../../tracking';

import { EditableName } from './EditableName';

interface EditableQueryNameProps {
  query: DataQuery;
  queries: DataQuery[];
  onQueryUpdate: (updatedQuery: DataQuery, originalRefId: string) => void;
}

export function EditableQueryName({ query, queries, onQueryUpdate }: EditableQueryNameProps) {
  const existingRefIds = useMemo(
    () => new Set(queries.filter((q) => q.refId !== query.refId).map((q) => q.refId)),
    [queries, query.refId]
  );

  const validateQueryName = (name: string): string | null => {
    if (name === query.refId) {
      return null;
    }

    if (name.length === 0) {
      return t('query-editor-next.validation.empty-name', 'An empty query name is not allowed');
    }

    if (existingRefIds.has(name)) {
      return t('query-editor-next.validation.duplicate-name', 'Query name already exists');
    }

    return null;
  };

  return (
    <EditableName
      value={query.refId}
      validate={validateQueryName}
      onCommit={(name) => onQueryUpdate({ ...query, refId: name }, query.refId)}
      onEditStart={trackRenameInitiated}
      label={t('query-editor-next.edit-query-name', 'Edit query name')}
      inputTestId="query-name-input"
    />
  );
}
