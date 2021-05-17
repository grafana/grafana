import React, { useState } from 'react';
import { PluginConfigPageProps, AppPluginMeta, PluginMeta } from '@grafana/data';
import { CatalogAppSettings } from 'types';
import { Button, Field, Legend, Switch } from '@grafana/ui';
import { api } from '../api';
import { PLUGIN_ID } from '../constants';

interface Props extends PluginConfigPageProps<AppPluginMeta<CatalogAppSettings>> {}

export const Settings = ({ plugin }: Props) => {
  const [meta, setMeta] = useState(plugin.meta);
  const [state, setState] = useState<CatalogAppSettings>(meta.jsonData ?? {});

  const { pinned, enabled } = meta;
  const { includeEnterprise } = state;

  const onSave = () => {
    updateAndReload(PLUGIN_ID, {
      pinned,
      enabled,
      jsonData: state,
    });
  };

  return (
    <>
      <Legend>General</Legend>
      <Field label="Enable app">
        <Switch
          value={enabled}
          onChange={(e) => {
            setMeta({ ...meta, enabled: e.currentTarget.checked });
          }}
        />
      </Field>
      <Field label="Pin app" description="Add the app to the side menu.">
        <Switch
          value={pinned}
          onChange={(e) => {
            setMeta({ ...meta, pinned: e.currentTarget.checked });
          }}
        />
      </Field>
      <Legend>Plugins</Legend>
      <Field
        label="Show Enterprise plugins"
        description="Enterprise plugins require a Grafana Enterprise subscription."
      >
        <Switch
          value={includeEnterprise}
          onChange={(e) => {
            setState({ ...state, includeEnterprise: e.currentTarget.checked });
          }}
        />
      </Field>
      <Button onClick={onSave}>Save</Button>
    </>
  );
};

const updateAndReload = async (pluginId: string, data: Partial<PluginMeta>) => {
  try {
    await api.updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};
