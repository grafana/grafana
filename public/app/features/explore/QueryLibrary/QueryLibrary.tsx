import { useLocalStorage } from 'react-use';

import { QueryLibraryExpmInfo } from './QueryLibraryExpmInfo';
import { QueryTemplatesList } from './QueryTemplatesList';
import { QueryActionButton } from './types';

export interface QueryLibraryProps {
  // List of active datasources to filter the query library by
  // E.g in Explore the active datasources are the datasources that are currently selected in the query editor
  activeDatasources?: string[];
  queryActionButton?: QueryActionButton;
}

export const QUERY_LIBRARY_LOCAL_STORAGE_KEYS = {
  explore: {
    notifyUserAboutQueryLibrary: 'grafana.explore.query-library.notifyUserAboutQueryLibrary',
    newButton: 'grafana.explore.query-library.newButton',
  },
};

export function QueryLibrary({ activeDatasources, queryActionButton }: QueryLibraryProps) {
  const [notifyUserAboutQueryLibrary, setNotifyUserAboutQueryLibrary] = useLocalStorage(
    QUERY_LIBRARY_LOCAL_STORAGE_KEYS.explore.notifyUserAboutQueryLibrary,
    true
  );

  return (
    <>
      <QueryLibraryExpmInfo
        isOpen={notifyUserAboutQueryLibrary || false}
        onDismiss={() => setNotifyUserAboutQueryLibrary(false)}
      />
      <QueryTemplatesList activeDatasources={activeDatasources} queryActionButton={queryActionButton} />
    </>
  );
}
