import { Page } from 'app/core/components/Page/Page';
import { useDataSourceSettingsNav } from 'app/features/connections/hooks/useDataSourceSettingsNav';
import { useDatasourceFailureByUID } from 'app/features/connections/hooks/useDatasourceAdvisorChecks';
import { useDispatch } from 'app/types/store';

import * as api from '../api';
import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { useDataSourceInfo } from '../components/useDataSourceInfo';
import { useDataSource, useDataSourceRights, useDataSourceSettings } from '../state/hooks';
import { getDataSourceComponentsPageId } from '../state/navModel';
import { setNameAndVersion } from '../state/reducers';
import { DATASOURCE_COMPONENTS_PAGE_ID } from '../utils';

interface Props {
  uid: string;
  pageId: string | null;
  componentId?: string | null;
}

function DataSourceTabPage({ uid, pageId, componentId }: Props) {
  const { plugin } = useDataSourceSettings();
  // Preview links use page=components even when the plugin owns that config page.
  const activePageId =
    pageId === DATASOURCE_COMPONENTS_PAGE_ID && componentId ? getDataSourceComponentsPageId(plugin) : pageId;
  const { navId, pageNav, dataSourceHeader } = useDataSourceSettingsNav(activePageId ?? undefined);
  const { datasourceFailureByUID, hasCheck: advisorChecked } = useDatasourceFailureByUID();

  const info = useDataSourceInfo({
    dataSourcePluginName: pageNav.dataSourcePluginName,
    alertingSupported: dataSourceHeader.alertingSupported,
    alertingLoading: dataSourceHeader.alertingLoading,
    failure: datasourceFailureByUID.get(uid),
    advisorChecked,
  });

  const dataSource = useDataSource(uid);
  const rights = useDataSourceRights(uid);
  const editable = rights.hasWriteRights && !rights.readOnly;

  const dispatch = useDispatch();

  const onEditTitle = async (value: string) => {
    // Make manual API calls to avoid pre-emptively saving other changes from the EditDataSource form
    // Use the original version from the Redux state to ensure we don't overwrite other name changes
    const ds = await api.getDataSourceByUid(uid);
    const up = await api.updateDataSource({ ...ds, name: value, version: dataSource.version });

    // Update the Redux state with the new name and version to allow the EditDataSource form to submit
    dispatch(
      setNameAndVersion({
        name: up.name,
        version: up.version,
      })
    );
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
        <EditDataSource uid={uid} pageId={activePageId} componentId={componentId} />
      </Page.Contents>
    </Page>
  );
}

export default DataSourceTabPage;
