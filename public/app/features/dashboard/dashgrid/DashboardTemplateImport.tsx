import { useCallback, useEffect, useState } from 'react';

import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Drawer, Form } from '@grafana/ui';
import { ImportDashboardForm } from 'app/features/manage-dashboards/components/ImportDashboardForm';
import { DashboardInputs } from 'app/features/manage-dashboards/state/reducers';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { InputUsage } from '../components/DashExportModal/DashboardExporter';

export interface Props {
  dashboardUid: string; // gnet dashboard uid
  onCancel: () => void;
}

const DashboardTemplateImport = ({ dashboardUid, onCancel }: Props) => {
  //from dashboard.json get constants, libraryPanels, and dataSources

  const defaultInputs: DashboardInputs = {
    constants: [],
    libraryPanels: [],
    dataSources: [],
  };

  const [inputs, setInputs] = useState<DashboardInputs>(defaultInputs);
  const [folder, setFolder] = useState({ uid: '' });
  const [communityDashboardToImport, setCommunityDashboardToImport] = useState<any>({});
  enum InputType {
    DataSource = 'datasource',
    Constant = 'constant',
    LibraryPanel = 'libraryPanel',
  }

  useEffect(() => {
    const processInputs = (dashboard: DashboardJson) => {
      if (dashboard && dashboard.__inputs) {
        const inputs: any[] = [];
        dashboard.__inputs.forEach((input: any) => {
          const inputModel: any = {
            name: input.name,
            label: input.label,
            info: input.description,
            value: input.value,
            type: input.type,
            pluginId: input.pluginId,
            options: [],
          };

          inputModel.description = getDataSourceDescription(input);

          if (input.type === InputType.DataSource) {
            getDataSourceOptions(input, inputModel);
          } else if (!inputModel.info) {
            inputModel.info = 'Specify a string constant';
          }

          inputs.push(inputModel);
        });
        return inputs;
      }
      return [];
    };

    const fetchAndProcessDashboard = async () => {
      try {
        const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${dashboardUid}`);
        const searchObj = locationService.getSearchObject();
        const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };

        setCommunityDashboardToImport(dashboard.json);
        setFolder(folder);
        setInputs(processInputs(dashboard.json));
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
        // Handle error appropriately
      }
    };

    fetchAndProcessDashboard();
  }, [dashboardUid, InputType.DataSource]); // Remove communityDashboardToImport from dependencies

  const getDataSourceDescription = (input: { usage?: InputUsage }): string | undefined => {
    if (!input.usage) {
      return undefined;
    }

    if (input.usage.libraryPanels) {
      const libPanelNames = input.usage.libraryPanels.reduce(
        (acc: string, libPanel, index) => (index === 0 ? libPanel.name : `${acc}, ${libPanel.name}`),
        ''
      );
      return `List of affected library panels: ${libPanelNames}`;
    }

    return undefined;
  };

  const getDataSourceOptions = (input: { pluginId: string; pluginName: string }, inputModel: any) => {
    const sources = getDataSourceSrv().getList({ pluginId: input.pluginId });

    if (sources.length === 0) {
      inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
    } else if (!inputModel.info) {
      inputModel.info = 'Select a ' + input.pluginName + ' data source';
    }
  };

  const onSubmitCommunityDashboard = useCallback((formData: any) => {
    console.log('formData', formData);
  }, []);

  const onCancelCommunityDashboard = useCallback(() => {
    onCancel();
  }, [onCancel]);

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
