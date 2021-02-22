import React from 'react';
import { ArgTypes } from '@storybook/react';
import { addons, types } from '@storybook/addons';
import { AddonPanel, ArgsTable } from '@storybook/components';
import { useArgs, useArgTypes, useParameter } from '@storybook/api';

const ADDON_ID = 'storybook/grafana-controls';
const PANEL_ID = `${ADDON_ID}/controls`;
const PARAM_KEY = 'grafanaControls';

const GrafanaControlsPanel = () => {
  const [args, updateArgs, resetArgs] = useArgs();
  const rows = useArgTypes();
  const { controls } = useParameter<ArgTypes>(PARAM_KEY, { controls: {} });
  const newRows: ArgTypes = {};

  for (const key in controls) {
    if (!Object.hasOwnProperty.call(controls, key)) {
      continue;
    }

    if (Object.hasOwnProperty.call(rows, key)) {
      newRows[key] = { ...rows[key], ...controls[key] };
    }
  }

  return (
    <ArgsTable rows={newRows} args={args} updateArgs={updateArgs} resetArgs={resetArgs as any} inAddonPanel compact />
  );
};

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title() {
      const { controls } = useParameter<ArgTypes>(PARAM_KEY, { controls: {} });
      const controlsCount = Object.values(controls).filter((argType) => argType?.control).length;
      const suffix = controlsCount === 0 ? '' : ` (${controlsCount})`;
      return `Controls${suffix}`;
    },
    paramKey: PARAM_KEY,
    /* eslint-disable react/display-name */
    // @ts-ignore
    render: ({ active, key }) => {
      if (!active || !api.getCurrentStoryData()) {
        return null;
      }
      return (
        <AddonPanel active={Boolean(active)} key={key}>
          <GrafanaControlsPanel />
        </AddonPanel>
      );
    },
  });
});
