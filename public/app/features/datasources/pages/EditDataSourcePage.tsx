import React from 'react';

import { getDataSourceSrv } from '@grafana/runtime';
import { Page } from 'app/core/components/Page/Page';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch } from 'app/types';

import { EditDataSource } from '../components/EditDataSource';
import { EditDataSourceActions } from '../components/EditDataSourceActions';
import { EditDataSourceTitle } from '../components/EditDataSourceTitle';
import { EditDataSourceSubtitle } from '../components/EditDatasSourceSubtitle';
import { useDataSourceSettingsNav, setDataSourceName, setIsDefault, useDataSource } from '../state';

export interface Props extends GrafanaRouteComponentProps<{ uid: string }> {}

export function EditDataSourcePage(props: Props) {
  const uid = props.match.params.uid;
  const params = new URLSearchParams(props.location.search);
  const pageId = params.get('page');
  const nav = useDataSourceSettingsNav(uid, pageId);
  const subTitle = nav.main.subTitle;
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
      navId="datasources"
      pageNav={nav.main}
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

export default EditDataSourcePage;
