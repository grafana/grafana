import { css } from '@emotion/css';
import React, { useState } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { Dashboard } from '@grafana/schema';
import { Button, Checkbox, TextArea, useStyles2, Stack } from '@grafana/ui';
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

  const onSave = () => {
    onSaveDashboard(dashboard, saveModel, options);
    dashboard.closeModal();
  };

  const onCancel = () => {
    dashboard.closeModal();
  };

  return (
    <Stack gap={2} direction="column" alignItems="flex-start">
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

      <Stack alignItems="center">
        <Button variant="secondary" onClick={onCancel} fill="outline">
          Cancel
        </Button>
        <Button
          disabled={!hasChanges || state.loading}
          icon={state.loading ? 'spinner' : undefined}
          aria-label={selectors.pages.SaveDashboardModal.save}
          onClick={onSave}
        >
          {state.loading ? 'Saving...' : 'Save'}
        </Button>
        {!hasChanges && <div>No changes to save</div>}
      </Stack>
    </Stack>
  );
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
