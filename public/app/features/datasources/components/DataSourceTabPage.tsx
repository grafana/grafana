import { Page } from 'app/core/components/Page/Page';
import { useDataSourceSettingsNav } from 'app/features/connections/hooks/useDataSourceSettingsNav';
import { useDatasourceFailureByUID } from 'app/features/connections/hooks/useDatasourceAdvisorChecks';
import { useDispatch } from 'app/types/store';

import * as api from '../api';
import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { useDataSourceInfo } from '../components/useDataSourceInfo';
import { useDataSourceRights } from '../state/hooks';
import { setDataSourceName } from '../state/reducers';

export interface Props {
  uid: string;
  pageId: string | null;
}

export function DataSourceTabPage({ uid, pageId }: Props) {
  const { navId, pageNav, dataSourceHeader } = useDataSourceSettingsNav(pageId ?? undefined);
  const { datasourceFailureByUID } = useDatasourceFailureByUID();

  const info = useDataSourceInfo({
    dataSourcePluginName: pageNav.dataSourcePluginName,
    alertingSupported: dataSourceHeader.alertingSupported,
    failure: datasourceFailureByUID.get(uid),
  });

  const rights = useDataSourceRights(uid);
  const editable = rights.hasWriteRights && !rights.readOnly;

  const dispatch = useDispatch();

  const onEditTitle = async (value: string) => {
    // Make manual API calls to avoid pre-emptively saving other changes from the EditDataSource form
    const ds = await api.getDataSourceByUid(uid);
    await api.updateDataSource({ ...ds, name: value });
    dispatch(setDataSourceName(value));
  };

  return (
    <Page
      navId={navId}
      pageNav={pageNav}
      onEditTitle={editable ? onEditTitle : undefined}
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
