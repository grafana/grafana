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
  const argTypes = useParameter<ArgTypes>(PARAM_KEY, {});
  const newRows: ArgTypes = {};

  for (const key in argTypes) {
    if (!Object.hasOwnProperty.call(argTypes, key)) {
      continue;
    }

    if (Object.hasOwnProperty.call(rows, key)) {
      newRows[key] = { ...rows[key], ...argTypes[key] };
    }
  }

  return (
    <ArgsTable rows={newRows} args={args} updateArgs={updateArgs} resetArgs={resetArgs as any} inAddonPanel compact />
  );
};

addons.register(ADDON_ID, (api) => {
  addons.add(PANEL_ID, {
    type: types.PANEL,
    title: 'Grafana Controls',
    // eslint-disable-next-line react/display-name
    render: ({ active, key }) => (
      <AddonPanel active={Boolean(active)} key={key}>
        <GrafanaControlsPanel />
      </AddonPanel>
    ),
  });
});
