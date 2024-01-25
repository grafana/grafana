import React, { useState } from 'react';

import { selectors } from '@grafana/e2e-selectors';
import { isFetchError } from '@grafana/runtime';
import { Button, Checkbox, TextArea, Stack, Alert, Box, ButtonVariant, Field } from '@grafana/ui';
import { SaveDashboardOptions } from 'app/features/dashboard/components/SaveDashboard/types';

import { DashboardScene } from '../scene/DashboardScene';

import { SaveDashboardDrawer } from './SaveDashboardDrawer';
import { DashboardChangeInfo } from './types';
import { useDashboardSave } from './useSaveDashboard';

export interface Props {
  dashboard: DashboardScene;
  drawer: SaveDashboardDrawer;
  changeInfo: DashboardChangeInfo;
}

export function SaveDashboardForm({ dashboard, drawer, changeInfo }: Props) {
  const { saveVariables = false, saveTimeRange = false } = drawer.useState();
  const { changedSaveModel, hasChanges, hasTimeChanged, hasVariableValuesChanged } = changeInfo;

  const { state, onSaveDashboard } = useDashboardSave(false);
  const [options, setOptions] = useState<SaveDashboardOptions>({
    folderUid: dashboard.state.meta.folderUid,
  });

  const onSave = async (overwrite: boolean) => {
    const result = await onSaveDashboard(dashboard, changedSaveModel, { ...options, overwrite });
    if (result.status === 'success') {
      dashboard.closeModal();
    }
  };

  const cancelButton = (
    <Button variant="secondary" onClick={() => dashboard.closeModal()} fill="outline">
      Cancel
    </Button>
  );

  const saveButton = (text: string, variant: ButtonVariant) => (
    <Button
      disabled={!hasChanges || state.loading}
      icon={state.loading ? 'spinner' : undefined}
      aria-label={selectors.pages.SaveDashboardModal.save}
      onClick={() => onSave(variant === 'destructive')}
      variant={variant}
    >
      {state.loading ? 'Saving...' : text}
    </Button>
  );

  function renderFooter(error?: Error) {
    if (isVersionMismatchError(error)) {
      return (
        <Alert title="Someone else has updated this dashboard" severity="error">
          <p>Would you still like to save this dashboard?</p>
          <Box paddingTop={2}>
            <Stack alignItems="center">
              {cancelButton}
              {saveButton('Save and overwrite', 'destructive')}
            </Stack>
          </Box>
        </Alert>
      );
    }

    if (isNameExistsError(error)) {
      return (
        <Alert title="Name already exists" severity="error">
          <p>
            A dashboard with the same name in selected folder already exists. Would you still like to save this
            dashboard?
          </p>
          <Box paddingTop={2}>
            <Stack alignItems="center">
              {cancelButton}
              {saveButton('Save and overwrite', 'destructive')}
            </Stack>
          </Box>
        </Alert>
      );
    }

    if (isPluginDashboardError(error)) {
      return (
        <Alert title="Plugin dashboard" severity="error">
          <p>
            Your changes will be lost when you update the plugin. Use <strong>Save As</strong> to create custom version.
          </p>
          <Box paddingTop={2}>
            <Stack alignItems="center">
              {cancelButton}
              {saveButton('Save and overwrite', 'destructive')}
            </Stack>
          </Box>
        </Alert>
      );
    }

    return (
      <>
        {error && (
          <Alert title="Failed to save dashboard" severity="error">
            <p>{error.message}</p>
          </Alert>
        )}
        <Stack alignItems="center">
          {cancelButton}
          {saveButton('Save', 'primary')}
          {!hasChanges && <div>No changes to save</div>}
        </Stack>
      </>
    );
  }

  return (
    <Stack gap={0} direction="column">
      {hasTimeChanged && (
        <Field label="Save current time range" description="Will make current time range the new default">
          <Checkbox
            checked={saveTimeRange}
            onChange={drawer.onToggleSaveTimeRange}
            aria-label={selectors.pages.SaveDashboardModal.saveTimerange}
          />
        </Field>
      )}
      {hasVariableValuesChanged && (
        <Field label="Save current variable values" description="Will make the current values the new default">
          <Checkbox
            checked={saveVariables}
            onChange={drawer.onToggleSaveVariables}
            label="Save current variable values as dashboard default"
            aria-label={selectors.pages.SaveDashboardModal.saveVariables}
          />
        </Field>
      )}
      <Field label="Message">
        {/* {config.featureToggles.dashgpt && (
          <GenAIDashboardChangesButton
            dashboard={dashboard}
            onGenerate={(text) => {
              onOptionsChange({
                ...options,
                message: text,
              });
              setMessage(text);
            }}
            disabled={!saveModel.hasChanges}
          />
        )} */}

        <TextArea
          aria-label="message"
          value={options.message ?? ''}
          onChange={(e) => {
            setOptions({
              ...options,
              message: e.currentTarget.value,
            });
          }}
          placeholder="Add a note to describe your changes (optional)."
          autoFocus
          rows={5}
        />
      </Field>
      <Box paddingTop={2}>{renderFooter(state.error)}</Box>
    </Stack>
  );
}

function isVersionMismatchError(error?: Error) {
  return isFetchError(error) && error.data && error.data.status === 'version-mismatch';
}

function isNameExistsError(error?: Error) {
  return isFetchError(error) && error.data && error.data.status === 'name-exists';
}

function isPluginDashboardError(error?: Error) {
  return isFetchError(error) && error.data && error.data.status === 'plugin-dashboard';
}
