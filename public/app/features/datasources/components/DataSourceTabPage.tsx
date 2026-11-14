import { Page } from 'app/core/components/Page/Page';
import { useDataSourceSettingsNav } from 'app/features/connections/hooks/useDataSourceSettingsNav';
import { useDatasourceFailureByUID } from 'app/features/connections/hooks/useDatasourceAdvisorChecks';
import { isManaged } from 'app/features/provisioning/utils/managedResource';
import { useDispatch } from 'app/types/store';

import * as api from '../api';
import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { useDataSourceInfo } from '../components/useDataSourceInfo';
import { useDataSourceProvisioning } from '../components/useDataSourceProvisioning';
import { useDataSource, useDataSourceRights } from '../state/hooks';
import { setNameAndVersion } from '../state/reducers';

interface Props {
  uid: string;
  pageId: string | null;
}

function DataSourceTabPage({ uid, pageId }: Props) {
  const { navId, pageNav, dataSourceHeader } = useDataSourceSettingsNav(pageId ?? undefined);
  const { datasourceFailureByUID, hasCheck: advisorChecked } = useDatasourceFailureByUID();
  const provisioning = useDataSourceProvisioning(uid);
  const managedResource = provisioning.resource;

  const info = useDataSourceInfo({
    dataSourcePluginName: pageNav.dataSourcePluginName,
    alertingSupported: dataSourceHeader.alertingSupported,
    alertingLoading: dataSourceHeader.alertingLoading,
    failure: datasourceFailureByUID.get(uid),
    advisorChecked,
    managedResource,
  });

  const dataSource = useDataSource(uid);
  const rights = useDataSourceRights(uid);
  // Inline title editing writes straight through the data source API, which would be overwritten by
  // the next sync, so a managed data source is renamed in its repository instead.
  const editable = rights.hasWriteRights && !rights.readOnly && !(managedResource && isManaged(managedResource));

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
        <EditDataSource uid={uid} pageId={pageId} provisioning={provisioning} />
      </Page.Contents>
    </Page>
  );
}

export default DataSourceTabPage;
