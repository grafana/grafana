import { useLocation, useParams } from 'react-router-dom';

import {
  useDataSource,
  useDataSourceSettingsNav as useDataSourceSettingsNavOriginal,
} from 'app/features/datasources/state/hooks';
import { useGetSingle } from 'app/features/plugins/admin/state/hooks';

// We are extending the original useDataSourceSettingsNav in the following ways:
// - changing the URL of the nav items to point to Connections
// - setting the parent nav item
export function useDataSourceSettingsNav(pageId?: string) {
  const { uid } = useParams<{ uid: string }>();
  const location = useLocation();
  const datasource = useDataSource(uid);
  const datasourcePlugin = useGetSingle(datasource.type);
  const params = new URLSearchParams(location.search);
  const nav = useDataSourceSettingsNavOriginal(uid, pageId || params.get('page'));
  const pageNav = {
    ...nav.main,
    text: datasource.name,
    subTitle: `Type: ${datasourcePlugin?.name}`,
    active: true,
    children: (nav.main.children || []).map((navModelItem) => ({
      ...navModelItem,
      url: navModelItem.url?.replace('datasources/edit/', '/connections/datasources/edit/'),
    })),
  };

  return {
    navId: 'connections-datasources',
    pageNav,
  };
}
