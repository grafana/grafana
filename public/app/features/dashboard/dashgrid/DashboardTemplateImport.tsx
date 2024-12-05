import { css } from '@emotion/css';
import { useCallback, useEffect, useState } from 'react';
import { lastValueFrom } from 'rxjs';
import { map } from 'rxjs/operators';

import { GrafanaTheme2 } from '@grafana/data';
import { getBackendSrv, locationService } from '@grafana/runtime';
import { Button, useStyles2, Text, Box, Stack, Drawer, Form } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';
import { DashboardScene } from 'app/features/dashboard-scene/scene/DashboardScene';
import { ImportDashboardForm } from 'app/features/manage-dashboards/components/ImportDashboardForm';
import { DashboardInputs } from 'app/features/manage-dashboards/state/reducers';

export interface Props {
  dashboard: any; // gnet dashboard
  onImport: (formData: any) => void;
  onCancel: () => void;
}

const DashboardTemplateImport = ({ dashboard, onImport, onCancel }: Props) => {
  console.log('dashboard', dashboard);

  //from dashboard.json get constants, libraryPanels, and dataSources

  const dashboardJson = dashboard.json;
  console.log('dashboardJson', dashboardJson);

  const inputs: DashboardInputs = {
    constants: [],
    libraryPanels: [],
    dataSources: [],
  };

  const [showTemplateImportForm, setShowTemplateImportForm] = useState(false);
  const [templateDashboards, setTemplateDashboards] = useState([]);
  const [communityDashboardToImport, setCommunityDashboardToImport] = useState({});

  const [folder, setFolder] = useState({ uid: '' });

  const getCommunityDashboards = async () => {
    // fetch dashboards from grafana.com
    const gnetDashboards = (await lastValueFrom(
      getBackendSrv()
        .fetch({
          url: '/api/gnet/dashboards',
          method: 'GET',
          params: {
            pageSize: 20,
          },
        })
        .pipe(map((res) => res.data))
    )) as any;
    setTemplateDashboards(gnetDashboards.items);

    console.log('gnetDashboards', gnetDashboards);
  };

  useEffect(() => {
    getCommunityDashboards();
  }, []);

  const onSubmitCommunityDashboard = useCallback((formData: any) => {
    console.log('formData', formData);
  }, []);

  const onCancelCommunityDashboard = useCallback(() => {
    setShowTemplateImportForm(false);
  }, []);

  const onUidResetCommunityDashboard = useCallback(() => {
    console.log('uid reset');
  }, []);

  const [uidReset, setUidReset] = useState(false);

  return (
    <div>
      <Drawer title="Import Template" onClose={() => onCancel()}>
        show the import template form here
        <Form
          onSubmit={onSubmitCommunityDashboard}
          defaultValues={{
            ...communityDashboardToImport,
            constants: [],
            dataSources: [],
            elements: [],
            folder: folder,
          }}
          validateOnMount
          validateFieldsOnMount={['title', 'uid']}
          validateOn="onChange"
        >
          {({ register, errors, control, watch, getValues }) => (
            <ImportDashboardForm
              register={register}
              errors={errors}
              control={control}
              getValues={getValues}
              uidReset={uidReset}
              inputs={inputs}
              onCancel={onCancelCommunityDashboard}
              onUidReset={onUidResetCommunityDashboard}
              onSubmit={onSubmitCommunityDashboard}
              watch={watch}
              initialFolderUid={folder.uid}
            />
          )}
        </Form>
      </Drawer>
    </div>
  );
};

export default DashboardTemplateImport;
