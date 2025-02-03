import { useLocalStorage } from 'react-use';

import { DataQuery } from '@grafana/schema';
import { Badge } from '@grafana/ui';

import { QueryOperationAction } from '../../../core/components/QueryOperationRow/QueryOperationAction';
import { t } from '../../../core/internationalization';

import { QUERY_LIBRARY_LOCAL_STORAGE_KEYS } from './QueryLibrary';
import { useQueryLibraryContext } from './QueryLibraryContext';

interface Props {
  query: DataQuery;
}

export function SaveQueryButton({ query }: Props) {
  const { openAddQueryModal } = useQueryLibraryContext();

  const [showQueryLibraryBadgeButton, setShowQueryLibraryBadgeButton] = useLocalStorage(
    QUERY_LIBRARY_LOCAL_STORAGE_KEYS.explore.newButton,
    true
  );

  return showQueryLibraryBadgeButton ? (
    <Badge
      text={t('query-operation.header.save-to-query-library-new', 'New: Save to query library')}
      icon="save"
      color="blue"
      onClick={() => {
        openAddQueryModal(query);
        setShowQueryLibraryBadgeButton(false);
      }}
      style={{ cursor: 'pointer' }}
    />
  ) : (
    <QueryOperationAction
      title={t('query-operation.header.save-to-query-library', 'Save to query library')}
      icon="save"
      onClick={() => {
        openAddQueryModal(query);
      }}
    />
  );
}
