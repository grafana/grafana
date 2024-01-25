import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { isFetchError } from '@grafana/runtime';
import { Dashboard } from '@grafana/schema';
import { Button, Checkbox, TextArea, useStyles2, Stack, Alert, Box, ButtonVariant } from '@grafana/ui';
import { SaveDashboardOptions } from 'app/features/dashboard/components/SaveDashboard/types';

import { DashboardScene } from '../scene/DashboardScene';

import { useDashboardSave } from './useSaveDashboard';

export interface Props {
  dashboard: DashboardScene;
  saveModel: Dashboard;
  hasChanges?: boolean;
  options: SaveDashboardOptions;
  onOptionsChange: (opts: SaveDashboardOptions) => void;
}

export function SaveDashboardForm({ dashboard, saveModel, hasChanges, options, onOptionsChange }: Props) {
  //   const hasTimeChanged = useMemo(() => dashboard.hasTimeChanged(), [dashboard]);
  //   const hasVariableChanged = useMemo(() => dashboard.hasVariablesChanged(), [dashboard]);

  const hasTimeChanged = false;
  const hasVariableChanged = false;

  const [message, setMessage] = useState(options.message);
  const styles = useStyles2(getStyles);
  const { state, onSaveDashboard } = useDashboardSave(false);

  const onSave = async (overwrite: boolean) => {
    const result = await onSaveDashboard(dashboard, saveModel, { ...options, overwrite });
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
    <Stack gap={2} direction="column">
      {hasTimeChanged && (
        <Checkbox
          checked={!!options.saveTimerange}
          onChange={() =>
            onOptionsChange({
              ...options,
              saveTimerange: !options.saveTimerange,
            })
          }
          label="Save current time range as dashboard default"
          aria-label={selectors.pages.SaveDashboardModal.saveTimerange}
        />
      )}
      {hasVariableChanged && (
        <Checkbox
          checked={!!options.saveVariables}
          onChange={() =>
            onOptionsChange({
              ...options,
              saveVariables: !options.saveVariables,
            })
          }
          label="Save current variable values as dashboard default"
          aria-label={selectors.pages.SaveDashboardModal.saveVariables}
        />
      )}
      <div className={styles.message}>
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
          value={message}
          onChange={(e) => {
            onOptionsChange({
              ...options,
              message: e.currentTarget.value,
            });
            setMessage(e.currentTarget.value);
          }}
          placeholder="Add a note to describe your changes."
          autoFocus
          rows={5}
        />
      </div>

      {renderFooter(state.error)}
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

function getStyles(theme: GrafanaTheme2) {
  return {
    message: css`
      display: flex;
      align-items: end;
      flex-direction: column;
      width: 100%;
    `,
  };
}
