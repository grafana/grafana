import { useCallback, useEffect, useMemo, useState, useRef } from 'react';

import { DataSourceInstanceSettings } from '@grafana/data';
import { getBackendSrv, getDataSourceSrv, locationService } from '@grafana/runtime';
import { Drawer, Form } from '@grafana/ui';
import { ImportInputs } from 'app/features/browse-dashboards/api/browseDashboardsAPI';
import { ImportDashboardForm } from 'app/features/manage-dashboards/components/ImportDashboardForm';
import { getLibraryPanelInputs } from 'app/features/manage-dashboards/state/actions';
import { DashboardInputs, LibraryPanelInputState } from 'app/features/manage-dashboards/state/reducers';
import { DashboardJson } from 'app/features/manage-dashboards/types';

import { Input, InputUsage, LibraryPanel } from '../components/DashExportModal/DashboardExporter';

export interface Props {
  dashboardUid: string;
  onCancel: () => void;
}

const DashboardTemplateImport = ({ dashboardUid, onCancel }: Props) => {
  const defaultInputs: DashboardInputs = {
    constants: [],
    libraryPanels: [],
    dataSources: [],
  };

  const [inputs, setInputs] = useState<DashboardInputs>(defaultInputs);
  const [folder, setFolder] = useState({ uid: '' });
  const [communityDashboardToImport, setCommunityDashboardToImport] = useState<any>({});
  const [uidReset, setUidReset] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const libraryPanelsRef = useRef<LibraryPanel[]>([]);

  const InputType = useMemo(
    () => ({
      DataSource: 'datasource',
      Constant: 'constant',
      LibraryPanel: 'libraryPanel',
    }),
    []
  );

  useEffect(() => {
    const fetchAndProcessDashboard = async () => {
      setIsLoading(true);
      try {
        const dashboard = await getBackendSrv().get(`/api/gnet/dashboards/${dashboardUid}`);
        const searchObj = locationService.getSearchObject();
        const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };

        setCommunityDashboardToImport(dashboard.json);
        setFolder(folder);
      } catch (error) {
        console.error('Failed to fetch dashboard:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchAndProcessDashboard();
  }, [dashboardUid]);

  const getDataSourceDescription = useCallback((input: { usage?: InputUsage }): string | undefined => {
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
  }, []);

  const getDataSourceOptions = useCallback((input: { pluginId: string; pluginName: string }, inputModel: any) => {
    const sources = getDataSourceSrv().getList({ pluginId: input.pluginId });

    if (sources.length === 0) {
      inputModel.info = 'No data sources of type ' + input.pluginName + ' found';
    } else if (!inputModel.info) {
      inputModel.info = 'Select a ' + input.pluginName + ' data source';
    }
  }, []);

  const getNewLibraryPanelsByInput = useCallback((input: Input): LibraryPanel[] | undefined => {
    return input?.usage?.libraryPanels?.filter((usageLibPanel) =>
      libraryPanelsRef.current.some(
        (libPanel) => libPanel.state !== LibraryPanelInputState.Exists && libPanel.model.uid === usageLibPanel.uid
      )
    );
  }, []);

  const processDashboard = useCallback(
    (dashboardJson: any, libraryPanels: LibraryPanel[]) => {
      if (!dashboardJson.__inputs) {
        return dashboardJson;
      }

      const dashboardInputs = !!libraryPanels?.length
        ? dashboardJson.__inputs.reduce((acc: Input[], input: Input) => {
          if (!input?.usage?.libraryPanels) {
            acc.push(input);
            return acc;
          }

          const newLibraryPanels = getNewLibraryPanelsByInput(input);
          if (newLibraryPanels?.length) {
            acc.push({
              ...input,
              usage: { libraryPanels: newLibraryPanels },
            });
          }
          return acc;
        }, [])
        : dashboardJson.__inputs;

      return { ...dashboardJson, __inputs: dashboardInputs };
    },
    [getNewLibraryPanelsByInput]
  );

  const processInputs = useCallback(
    (dashboard: DashboardJson) => {
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
    },
    [InputType, getDataSourceOptions, getDataSourceDescription]
  );

  useEffect(() => {
    if (!communityDashboardToImport || !Object.keys(communityDashboardToImport).length) {
      return;
    }

    let isMounted = true;
    setIsLoading(true);

    const processDashboardsInputsForForm = async () => {
      try {
        const libraryPanels = await getLibraryPanelInputs(communityDashboardToImport);
        libraryPanelsRef.current = libraryPanels;

        if (!isMounted) {
          return;
        }

        const dashboardJsonFiltered = processDashboard(communityDashboardToImport, libraryPanels);
        const inputsFinal = processInputs(dashboardJsonFiltered);

        const inputsForm = {
          constants: inputsFinal.filter((input) => input.type === InputType.Constant),
          dataSources: inputsFinal.filter((input) => input.type === InputType.DataSource),
          libraryPanels: libraryPanels,
        };

        setInputs(inputsForm);
      } catch (error) {
        console.error('Error processing dashboard:', error);
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    processDashboardsInputsForForm();

    return () => {
      isMounted = false;
    };
  }, [communityDashboardToImport, InputType, processInputs, processDashboard]);

  const onSubmitCommunityDashboard = useCallback(
    (formData: any) => {
      const inputsToPersist: ImportInputs[] = [];

      formData.dataSources?.forEach((dataSource: DataSourceInstanceSettings, index: number) => {
        const input = inputs.dataSources[index];
        if (input) {
          inputsToPersist.push({
            name: input.name,
            type: input.type,
            pluginId: input.pluginId,
            value: dataSource.uid,
          });
        }
      });

      formData.constants?.forEach((constant: string, index: number) => {
        const input = inputs.constants[index];
        if (input) {
          inputsToPersist.push({
            value: constant,
            name: input.name,
            type: input.type,
          });
        }
      });

      console.log('Processing inputs:', inputsToPersist);
    },
    [inputs]
  );

  const onCancelCommunityDashboard = useCallback(() => {
    onCancel();
  }, [onCancel]);

  const onUidResetCommunityDashboard = useCallback(() => {
    console.log('uid reset');
  }, []);

  if (isLoading) {
    return <div>Loading...</div>; // Consider using a proper loading component
  }

  return (
    <div>
      <Drawer title="Import Template" onClose={() => onCancel()}>
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

