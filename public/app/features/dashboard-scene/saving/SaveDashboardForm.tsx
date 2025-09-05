import { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { Button, Checkbox, TextArea, Stack, Alert, Box, Field } from '@grafana/ui';
import { SaveDashboardOptions } from 'app/features/dashboard/components/SaveDashboard/types';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import {
  DashboardChangeInfo,
  NameAlreadyExistsError,
  SaveButton,
  isNameExistsError,
  isPluginDashboardError,
  isVersionMismatchError,
} from './shared';
import { useSaveDashboard } from './useSaveDashboard';

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveDashboardForm({ dashboard, drawer, changeInfo }: Props) {
  const { changedSaveModel, hasChanges } = changeInfo;

  const { state, onSaveDashboard } = useSaveDashboard(false);
  const [options, setOptions] = useState<SaveDashboardOptions>({
    folderUid: dashboard.state.meta.folderUid,
  });

  const onSave = async (overwrite: boolean) => {
    const result = await onSaveDashboard(dashboard, changedSaveModel, { ...options, overwrite });
    if (result.status === 'success') {
      dashboard.closeModal();
      drawer.state.onSaveSuccess?.();
    }
  };

  const cancelButton = (
    <Button variant="secondary" onClick={() => dashboard.closeModal()} fill="outline">
      Отмена
    </Button>
  );

  const saveButton = (overwrite: boolean) => (
    <SaveButton isValid={hasChanges} isLoading={state.loading} onSave={onSave} overwrite={overwrite} />
  );

  function renderFooter(error?: Error) {
    if (isVersionMismatchError(error)) {
      return (
        <Alert title="Кто-то другой обновил этот дашборд" severity="error">
          <p>Вы все еще хотите сохранить этот дашборд?</p>
          <Box paddingTop={2}>
            <Stack alignItems="center">
              {cancelButton}
              {saveButton(true)}
            </Stack>
          </Box>
        </Alert>
      );
    }

    if (isNameExistsError(error)) {
      return <NameAlreadyExistsError cancelButton={cancelButton} saveButton={saveButton} />;
    }

    if (isPluginDashboardError(error)) {
      return (
        <Alert title="Панель управления плагинами" severity="error">
          <p>
            Your changes will be lost when you update the plugin. Use <strong>Save As</strong> to create custom version.
          </p>
          <Box paddingTop={2}>
            <Stack alignItems="center">
              {cancelButton}
              {saveButton(true)}
            </Stack>
          </Box>
        </Alert>
      );
    }

    return (
      <>
        {error && (
          <Alert title="Не удалось сохранить панель мониторинга" severity="error">
            <p>{error.message}</p>
          </Alert>
        )}
        <Stack alignItems="center">
          {cancelButton}
          {saveButton(false)}
          {!hasChanges && <div>Нет изменений для сохранения</div>}
        </Stack>
      </>
    );
  }

  return (
    <Stack gap={2} direction="column">
      <SaveDashboardFormCommonOptions drawer={drawer} changeInfo={changeInfo} />
      <Field label="Сообщение">
        <TextArea
          aria-label="message"
          value={options.message ?? ''}
          onChange={(e) => {
            setOptions({
              ...options,
              message: e.currentTarget.value,
            });
          }}
          placeholder="Добавьте примечание с описанием ваших изменений."
          autoFocus
          rows={5}
        />
      </Field>
      {renderFooter(state.error)}
    </Stack>
  );
}

export interface SaveDashboardFormCommonOptionsProps {
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveDashboardFormCommonOptions({ drawer, changeInfo }: SaveDashboardFormCommonOptionsProps) {
  const { saveVariables = false, saveTimeRange = false, saveRefresh = false } = drawer.useState();
  const { hasTimeChanges, hasVariableValueChanges, hasRefreshChange } = changeInfo;

  return (
    <Stack direction={'column'} alignItems={'flex-start'}>
      {hasTimeChanges && (
        <Checkbox
          id="save-timerange"
          checked={saveTimeRange}
          onChange={drawer.onToggleSaveTimeRange}
          label="Обновить диапазон времени по умолчанию"
          description={'Сделает текущий временной диапазон новым значением по умолчанию'}
          data-testid={selectors.pages.SaveDashboardModal.saveTimerange}
        />
      )}
      {hasRefreshChange && (
        <Checkbox
          id="save-refresh"
          label="Обновить значение обновления по умолчанию"
          description="Сделает текущее обновление новым значением по умолчанию"
          checked={saveRefresh}
          onChange={drawer.onToggleSaveRefresh}
          data-testid={selectors.pages.SaveDashboardModal.saveRefresh}
        />
      )}
      {hasVariableValueChanges && (
        <Checkbox
          id="save-variables"
          label="Обновить значения переменных по умолчанию"
          description="Сделает текущие значения новыми по умолчанию"
          checked={saveVariables}
          onChange={drawer.onToggleSaveVariables}
          data-testid={selectors.pages.SaveDashboardModal.saveVariables}
        />
      )}
    </Stack>
  );
}
