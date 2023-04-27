import * as React from 'react';
import { useLocation, useParams } from 'react-router-dom';

import { getDataSourceSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { EditDataSource } from 'app/features/datasources/components/EditDataSource';
import { EditDataSourceActions } from 'app/features/datasources/components/EditDataSourceActions';
import { EditDataSourceTitle } from 'app/features/datasources/components/EditDataSourceTitle';
import { EditDataSourceSubtitle } from 'app/features/datasources/components/EditDatasSourceSubtitle';
import { setDataSourceName, setIsDefault, useDataSource } from 'app/features/datasources/state';
import { useDispatch } from 'app/types';

import { useDataSourceSettingsNav } from '../hooks/useDataSourceSettingsNav';

export function EditDataSourcePage() {
  const { uid } = useParams<{ uid: string }>();
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const pageId = params.get('page');
  const { navId, pageNav } = useDataSourceSettingsNav();
  const subTitle = pageNav.subTitle;
  const dispatch = useDispatch();
  const dataSource = useDataSource(uid);
  const dsi = getDataSourceSrv()?.getInstanceSettings(uid);
  const hasAlertingEnabled = Boolean(dsi?.meta?.alerting ?? false);
  const isAlertManagerDatasource = dsi?.type === 'alertmanager';
  const alertingSupported = hasAlertingEnabled || isAlertManagerDatasource;
  const onNameChange = (name: string) => dispatch(setDataSourceName(name));
  const onDefaultChange = (value: boolean) => dispatch(setIsDefault(value));
  return (
    <Page
      navId={navId}
      pageNav={pageNav}
      renderTitle={(title) => <EditDataSourceTitle title={title} onNameChange={onNameChange} />}
      subTitle={
        <EditDataSourceSubtitle
          subTitle={subTitle}
          isDefault={dataSource.isDefault || false}
          alertingSupported={alertingSupported}
          onDefaultChange={onDefaultChange}
        />
      }
      actions={<EditDataSourceActions uid={uid} />}
    >
      <Page.Contents>
        <EditDataSource uid={uid} pageId={pageId} />
      </Page.Contents>
    </Page>
  );
}
