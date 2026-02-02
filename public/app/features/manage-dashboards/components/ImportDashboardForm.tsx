import { useEffect, useState } from 'react';
import { Controller, FieldErrors, UseFormReturn } from 'react-hook-form';

import { selectors } from '@grafana/e2e-selectors';
import { getBackendSrv } from '@grafana/runtime';
import { ExpressionDatasourceRef } from '@grafana/runtime/src/utils/DataSourceWithBackend';
import {
  Button,
  Field,
  FormFieldErrors,
  FormsOnSubmit,
  Stack,
  Input,
  Legend,
  Alert,
  VerticalGroup,
  InputControl,
  Tooltip,
  Select,
} from '@grafana/ui';
import { FolderPicker } from 'app/core/components/Select/FolderPicker';
import { t, Trans } from 'app/core/internationalization';
import { DataSourcePicker } from 'app/features/datasources/components/picker/DataSourcePicker';

import {
  DashboardInput,
  DashboardInputs,
  DataSourceInput,
  ImportDashboardDTO,
  LibraryPanelInputState,
  ViewInput,
} from '../state/reducers';
import { validateTitle, validateUid } from '../utils/validation';

import { ImportDashboardLibraryPanelsList } from './ImportDashboardLibraryPanelsList';

interface Props extends Pick<UseFormReturn<ImportDashboardDTO>, 'register' | 'control' | 'getValues' | 'watch'> {
  uidReset: boolean;
  inputs: DashboardInputs;
  errors: FieldErrors<ImportDashboardDTO>;
  onCancel: () => void;
  onUidReset: () => void;
  onSubmit: FormsOnSubmit<ImportDashboardDTO>;
  // BMC Code: Next line
  isMultiple?: boolean;
  inputsToPersist?: any[];
  panels?: any[];
  setValue?: Function;
  variableList?: any[];
}
// BMC code: start
type ViewListItem = { label: string; value: number };
type ViewListType = { id: number; itsmCompVersion: string; name: string; deleted: boolean };
type SelectedViewType = Record<number, ViewListItem>;
type ViewTooltip = Record<number, boolean>;
const VQBViewType = 'Views';
// BMC code: end

export const ImportDashboardForm = ({
  register,
  errors,
  control,
  getValues,
  uidReset,
  inputs,
  onUidReset,
  onCancel,
  onSubmit,
  watch,
  // BMC Code: Next 2 line
  isMultiple,
  inputsToPersist,
  panels,
  setValue,
  variableList,
}: Props) => {
  const [isSubmitted, setSubmitted] = useState(false);
  // BMC Code: Next line
  const [viewList, setViewList] = useState<ViewListItem[]>([]);
  const [selectedView, setSelectedView] = useState<SelectedViewType>({});
  const [viewToolTip, setViewToolTip] = useState<ViewTooltip>({});
  const watchDataSources = watch('dataSources');
  const watchFolder = watch('folder');
  const [warningVQBMessage, setWarningVQBMessage] = useState(false);

  /*
    This useEffect is needed for overwriting a dashboard. It
    submits the form even if there's validation errors on title or uid.
  */
  useEffect(() => {
    if (isSubmitted && (errors.title || errors.uid)) {
      onSubmit(getValues());
    }
  }, [errors, getValues, isSubmitted, onSubmit]);

  // BMC Code: start
  useEffect(() => {
    // Function to fetch data from the API
    const getViewList = async () => {
      const data: ViewListType[] = await getBackendSrv().get('/api/rmsmetadata/view/list');
      // Fix for 25.3 filtering a view "Configuration Management GenAI Ready",
      // VQB does not support as of 25.3
      const skipView = 'Configuration Management GenAI Ready';
      setViewList(
        Array.isArray(data) ? data.filter((i) => !i.deleted && i.name !== skipView).map((item) => ({ label: item.name, value: item.id })) : []
      );
    };
    // Only make the API call if the condition is true
    if (viewList.length === 0 && inputs?.vqbViews?.length) {
      getViewList();
    }
  }, [inputs?.vqbViews?.length, viewList.length]);

  useEffect(() => {
    if (viewList.length) {
      const selectionObject: SelectedViewType = {};
      inputs?.vqbViews?.forEach((input) => {
        selectionObject[input.id] = viewList.find((list) => list.label === input.label) || {} as ViewListItem;
        setViewToolTip((prev: any) => ({
          ...prev,
          [input.id]: viewList.some((list) => list.label === input.label),
        }));
      });
      setSelectedView(selectionObject);
    }
  }, [viewList, inputs?.vqbViews]);
  // BMC Code: end

  const newLibraryPanels = inputs?.libraryPanels?.filter((i) => i.state === LibraryPanelInputState.New) ?? [];
  const existingLibraryPanels = inputs?.libraryPanels?.filter((i) => i.state === LibraryPanelInputState.Exists) ?? [];

  // BMC Code: start
  useEffect(() => {
    if (inputs && inputs?.vqbViews?.length === 0) {
      vqbIntegrationFound(panels, variableList) && setWarningVQBMessage(true);
    }
    return () => {
      setWarningVQBMessage(false);
    };
  }, [inputs, panels, variableList]);
  // BMC Code: end

  const vqb = 'visual query builder';
  return (
    <>
      {/* BMC Code: Next line */}
      {warningVQBMessage && (
        <Alert
          title={'VQB' + t('bmc.dashboard-import.panel-import', 'Panel import')}
          severity={'warning'}
          onRemove={(e) => setWarningVQBMessage(false)}
          elevated
        >
          <VerticalGroup>
            <div>
              <Trans i18nKey="bmc.dashboard-import.panel-import-alert">
                The import has a {{ vqb }} panel. Please re-export it from the desired environment, or manual
                intervention will be required for view selection.
              </Trans>
            </div>
          </VerticalGroup>
        </Alert>
      )}
      {!isMultiple ? (
        <Legend>
          <Trans i18nKey="bmc.dashboard-import.options">Options</Trans>
        </Legend>
      ) : null}
      <Field label={t('', 'Name')} invalid={!!errors.title} error={errors.title && errors.title.message}>
        <Input
          {...register('title', {
            required: t('bmcgrafana.dashboard-import.name-validation-text', 'Name is required'),
            validate: async (v: string) => {
              if (!isSubmitted) {
                return await validateTitle(v, getValues().folder.uid);
              }
              return errors.title?.message;
            },
          })}
          type="text"
          data-testid={selectors.components.ImportDashboardForm.name}
        />
      </Field>
      <Field label={t('bmcgrafana.dashboard-import.folder', 'Folder')}>
        <Controller
          render={({ field: { ref, value, onChange, ...field } }) => (
            <FolderPicker {...field} onChange={(uid, title) => onChange({ uid, title })} value={value.uid} />
          )}
          name="folder"
          control={control}
        />
      </Field>
      <Field
        label={t('bmcgrafana.dashboard-import.uid', 'Unique identifier (UID)')}
        description={t(
          'bmcgrafana.dashboard-import.uid-desc',
          'The unique identifier (UID) of a dashboard can be used for uniquely identify a dashboard between multiple Grafana installs. The UID allows having consistent URLs for accessing dashboards so changing the title of a dashboard will not break any bookmarked links to that dashboard.'
        )}
        invalid={!!errors.uid}
        error={errors.uid && errors.uid.message}
      >
        <>
          {!uidReset ? (
            <Input
              disabled
              {...register('uid', {
                validate: async (v: string) => {
                  if (!isSubmitted) {
                    return await validateUid(v);
                  }
                  return errors.uid?.message;
                },
              })}
              addonAfter={
                !uidReset && (
                  <Button onClick={onUidReset}>
                    <Trans i18nKey="bmcgrafana.dashboard-import.change-uid">Change uid</Trans>
                  </Button>
                )
              }
            />
          ) : (
            <Input
              {...register('uid', {
                required: true,
                validate: async (v: string) => {
                  if (!isSubmitted) {
                    return await validateUid(v);
                  }
                  return errors.uid?.message;
                },
              })}
            />
          )}
        </>
      </Field>
      {inputs.dataSources &&
        inputs.dataSources.map((input: DataSourceInput, index: number) => {
          if (input.pluginId === ExpressionDatasourceRef.type) {
            return null;
          }
          const dataSourceOption = `dataSources.${index}` as const;
          const current = watchDataSources ?? [];
          // BMC Code : Next block
          const currDs = inputsToPersist?.find((item: any) => {
            return item.pluginId === input.pluginId && item.type === input.type;
          });
          return (
            <Field
              label={input.label}
              description={input.description}
              key={dataSourceOption}
              invalid={errors.dataSources && !!errors.dataSources[index]}
              error={
                errors.dataSources &&
                errors.dataSources[index] &&
                t('bmcgrafana.dashboard-import.datasource-validation', 'A data source is required')
              }
            >
              <Controller
                name={dataSourceOption}
                render={({ field: { ref, ...field } }) => (
                  <DataSourcePicker
                    {...field}
                    noDefault={true}
                    placeholder={input.info}
                    pluginId={input.pluginId}
                    // BMC Code: Inline
                    current={current[index]?.uid ?? currDs?.value}
                  />
                )}
                control={control}
                rules={{ required: true }}
              />
            </Field>
          );
        })}
      {/* BMC Code: Next line */}
      {inputs.vqbViews &&
        inputs.vqbViews.map((input: ViewInput, index: number) => {
          const fieldView = `vqbViews.${index}` as const;
          if (setValue && selectedView[input.id]) {
            setValue(fieldView, { id: input.id, ...selectedView[input.id] });
          }
          return (
            <Field
              label={`View: ${index + 1}`}
              description={input.description}
              key={fieldView}
              invalid={errors.vqbViews && !!errors.vqbViews[index]}
              error={
                errors.vqbViews &&
                errors.vqbViews[index] &&
                t('bmcgrafana.dashboard-import.view-selection-validation', 'A view selection is required')
              }
            >
              <InputControl
                name={fieldView}
                render={({ field: { ref, ...field } }) => (
                  <Tooltip
                    placement={'bottom-end'}
                    content={t(
                      'bmcgrafana.dashboard-import.view-selection-tooltip',
                      'Do not change the pre-selected view'
                    )}
                    show={viewToolTip[input.id]}
                  >
                    <div>
                      <Select
                        id="view-list"
                        {...field}
                        onChange={(val: any) => {
                          const selectedNewView = {
                            id: Number(input.id),
                            ...val,
                          };
                          field.onChange(selectedNewView);
                          setSelectedView((prevState: any) => {
                            return {
                              ...prevState,
                              [input.id]: val,
                            };
                          });
                          return;
                        }}
                        value={(selectedView as Record<number, ViewListItem>)[input.id]}
                        options={viewList}
                        placeholder={t('bmcgrafana.dashboard-import.select-view', 'Select view')}
                      />
                    </div>
                  </Tooltip>
                )}
                control={control}
                rules={{ required: true }}
              />
            </Field>
          );
        })}
      {inputs.constants &&
        inputs.constants.map((input: DashboardInput, index) => {
          const constantIndex = `constants.${index}` as const;
          // BMC Code : Next block
          const currConst =
            isMultiple &&
            inputsToPersist?.find((item: any) => {
              return item.name === input.name && item.type === input.type;
            });
          return (
            <Field
              label={input.label}
              error={
                errors.constants &&
                errors.constants[index] &&
                `${input.label} ${t('bmcgrafana.dashboard-import.needs-value', 'needs a value')}`
              }
              invalid={errors.constants && !!errors.constants[index]}
              key={constantIndex}
            >
              <Input
                {...register(constantIndex, { required: true })}
                // BMC Code: Inline
                defaultValue={currConst?.value ?? input.value}
              />
            </Field>
          );
        })}
      <ImportDashboardLibraryPanelsList
        inputs={newLibraryPanels}
        label={t('bmcgrafana.dashboard-import.new-library-panels', 'New library panels')}
        description={t(
          'bmcgrafana.dashboard-import.new-library-panels-desc',
          'List of new library panels that will get imported.'
        )}
        folderName={watchFolder.title}
      />
      <ImportDashboardLibraryPanelsList
        inputs={existingLibraryPanels}
        label={t('bmcgrafana.dashboard-import.existing-library-panels', 'Existing library panels')}
        description={t(
          'bmcgrafana.dashboard-import.existing-library-panels-desc',
          'List of existing library panels. These panels are not affected by the import.'
        )}
        folderName={watchFolder.title}
      />
      <Stack>
        <Button
          type="submit"
          data-testid={selectors.components.ImportDashboardForm.submit}
          variant={getButtonVariant(errors)}
          onClick={() => {
            setSubmitted(true);
          }}
        >
          {getButtonText(errors, isMultiple)}
        </Button>
        <Button type="reset" variant="secondary" onClick={onCancel}>
          {/* BMC Code: Next line */}
          {isMultiple ? t('bmc.common.delete', 'Delete') : t('bmc.common.cancel', 'Cancel')}
        </Button>
      </Stack>
    </>
  );
};

// BMC Code: start
function vqbIntegrationFound(panels: any[] | undefined, variableList: any[] | undefined): boolean {
  let panelFound = false;
  if (panels && panels.length) {
    panelFound = panels.some(
      (panel) =>
        panel.targets &&
        panel.targets.some(
          (target: { sourceQuery: { queryType: string } }) => target?.sourceQuery?.queryType === VQBViewType
        )
    );
  }
  let variableFound = false;
  if (variableList && variableList.length) {
    variableFound = variableList?.some((list) => list?.query?.sourceQuery?.queryType === VQBViewType);
  }
  return panelFound || variableFound;
}
// BMC Code: end

function getButtonVariant(errors: FormFieldErrors<ImportDashboardDTO>) {
  return errors && (errors.title || errors.uid) ? 'destructive' : 'primary';
}

// BMC Code: Inline function
function getButtonText(errors: FormFieldErrors<ImportDashboardDTO>, isMultiple?: boolean) {
  const hasErrors = errors && (errors.title || errors.uid);
  const actionText = !isMultiple ? t('bmc.dashboard-import.import-text', 'Import') : t('bmc.common.save', 'Save');

  return hasErrors ? `${actionText} ${t('bmc.dashboard-import.overwrite', 'Overwrite')}` : actionText;
}
