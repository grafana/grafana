import * as React from 'react';

import { locationService } from '@grafana/runtime';
import { Collapse, Form, Label, Icon } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { ImportDashboardForm } from 'app/features/manage-dashboards/components/ImportDashboardForm';

import { ImportDashboardDTO } from '../state/reducers';

export const DashboardsOverview: React.FC<any> = ({ importOperations }) => {
  const [accordionIndex, setAccIndex] = React.useState<number>(0);
  const dashboardsKey = React.useMemo(() => {
    return Object.keys(importOperations.store.dashboards);
  }, [importOperations]);
  const setUpdatedDashboard = React.useMemo(() => {
    return (dashId: string, dashIndex: number, form: ImportDashboardDTO) => {
      if (dashboardsKey.length - 1 >= dashIndex + 1) {
        setAccIndex(dashIndex + 1);
      } else {
        setAccIndex(-1);
      }
      importOperations.updateDashboard(dashId, form);
    };
  }, [dashboardsKey, importOperations]);
  return (
    <div>
      {dashboardsKey.length > 0 ? (
        dashboardsKey.map((dash, index) => {
          return importOperations.store.dashboards[dash] ? (
            <Collapse
              collapsible={true}
              isOpen={index === accordionIndex}
              key={`${dash}-${index}`}
              label={
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <>{importOperations.store.dashboards[dash].dashId}</>
                  {importOperations.store.dashboards[dash].checked ? (
                    <Icon name="check-circle" style={{ color: 'green', marginLeft: '10px' }} />
                  ) : null}
                </div>
              }
              onToggle={(isOpen) => {
                isOpen ? setAccIndex(index) : setAccIndex(-1);
              }}
            >
              <ImportDashboardOverview
                dashboard={importOperations.store.dashboards[dash]}
                updateDashboard={setUpdatedDashboard}
                clearDashboardById={(dashId: string) => {
                  importOperations.clearLoadedDashboard(dashId);
                }}
                index={index}
              />
            </Collapse>
          ) : null;
        })
      ) : (
        <>
          <Label>
            <Trans i18nKey="bmc.bulk-operations.import.no-import">No Dashboards Imported</Trans>
          </Label>
        </>
      )}
    </div>
  );
};

const ImportDashboardOverview: React.FC<any> = ({ dashboard, updateDashboard, index, clearDashboardById }) => {
  const searchObj = locationService.getSearchObject();
  const folder = searchObj.folderUid ? { uid: String(searchObj.folderUid) } : { uid: '' };
  const [uidReset, setUidReset] = React.useState<boolean>(false);
  const onSubmit = React.useMemo(() => {
    return (form: ImportDashboardDTO) => {
      updateDashboard(dashboard.dashId, index, form);
    };
  }, [dashboard.dashId, index, updateDashboard]);
  const onCancel = React.useMemo(() => {
    return () => {
      clearDashboardById(dashboard.dashId);
    };
  }, [clearDashboardById, dashboard.dashId]);
  const onUidReset = React.useMemo(() => {
    return () => {
      setUidReset(true);
    };
  }, [setUidReset]);
  const { dashboard: dash, inputs = {}, inputsToPersist = [], folderId } = dashboard;
  if (folderId !== undefined) {
    folder.uid = folderId;
  }
  const dataSources: any[] = [];
  if (inputs.dataSources?.length > 0 && inputsToPersist.length > 0) {
    inputs.dataSources.forEach((item: any) => {
      const persistedInput = inputsToPersist.find((i: any) => i.type === item.type && i.pluginId && item.pluginId);
      if (persistedInput) {
        dataSources.push({ name: persistedInput.name, type: persistedInput.type, uid: persistedInput.value });
      } else {
        dataSources.push(undefined);
      }
    });
  }
  const constants: any[] = [];
  if (inputs.constants?.length > 0 && inputsToPersist.length > 0) {
    inputs.constants.forEach((item: any) => {
      const persistedInput = inputsToPersist.find((i: any) => i.type === item.type && i.name && item.name);
      if (persistedInput) {
        dataSources.push(persistedInput.value);
      } else {
        dataSources.push(undefined);
      }
    });
  }
  return (
    <>
      <Form
        style={{ paddingLeft: '10px' }}
        onSubmit={onSubmit}
        defaultValues={{
          ...dash,
          constants: constants,
          dataSources: dataSources,
          elements: [],
          folder: folder,
        }}
        validateOnMount
        validateFieldsOnMount={['title', 'uid']}
        validateOn="onChange"
      >
        {({ register, errors, control, watch, getValues, setValue }) => (
          <ImportDashboardForm
            register={register}
            errors={errors}
            control={control}
            getValues={getValues}
            uidReset={uidReset}
            inputs={inputs}
            onCancel={onCancel}
            onUidReset={onUidReset}
            onSubmit={onSubmit}
            watch={watch}
            isMultiple={true}
            inputsToPersist={inputsToPersist ?? []}
            panels={dash.panels}
            variableList={dash?.templating?.list}
            setValue={setValue}
          />
        )}
      </Form>
    </>
  );
};
