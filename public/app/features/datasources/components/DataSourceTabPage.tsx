import { Page } from 'app/core/components/Page/Page';
import { useDataSourceTabNav } from 'app/features/connections/hooks/useDataSourceTabNav';

import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { useDataSourceInfo } from '../components/useDataSourceInfo';

import { DataSourceTitle } from './DataSourceTitle';

export interface Props {
  uid: string;
  pageId: string | null;
}

export function DataSourceTabPage({ uid, pageId }: Props) {
  const { navId, pageNav, dataSourceHeader } = useDataSourceTabNav('settings');

  const info = useDataSourceInfo({
    dataSourcePluginName: pageNav.dataSourcePluginName,
    alertingSupported: dataSourceHeader.alertingSupported,
  });

  return (
    <Page
      navId={navId}
      pageNav={pageNav}
      renderTitle={(title) => <DataSourceTitle title={title} />}
      info={info}
      actions={<EditDataSourceActions uid={uid} />}
    >
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}

export default DataSourceTabPage;
