import React, { useState } from 'react';
import { PluginConfigPageProps, AppPluginMeta, PluginMeta } from '@grafana/data';
import { MarketplaceAppSettings } from 'types';
import { Button, Field, Input, Legend, Switch } from '@grafana/ui';
import { getBackendSrv } from '@grafana/runtime';

interface Props extends PluginConfigPageProps<AppPluginMeta<MarketplaceAppSettings>> {}

export const Settings = ({ plugin }: Props) => {
  const [meta, setMeta] = useState(plugin.meta);
  const [state, setState] = useState<MarketplaceAppSettings>(meta.jsonData ?? {});

  const { pinned, enabled } = meta;
  const { includeEnterprise, includeUnsigned, pluginDir } = state;

  const onSave = () => {
    updateAndReload('grafana-marketplace-app', {
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
      <Field label="Show unsigned plugins" description="Grafana can't guarantee the integrity of unsigned plugins.">
        <Switch
          value={includeUnsigned}
          onChange={(e) => {
            setState({ ...state, includeUnsigned: e.currentTarget.checked });
          }}
        />
      </Field>
      <Field label="Plugin directory" description="Path where plugins will be installed.">
        <Input value={pluginDir} onChange={(e) => setState({ ...state, pluginDir: e.currentTarget.value })} />
      </Field>
      <Button onClick={onSave}>Save</Button>
    </>
  );
};

const updateAndReload = async (pluginId: string, data: Partial<PluginMeta>) => {
  try {
    await updatePlugin(pluginId, data);

    // Reloading the page as the changes made here wouldn't be propagated to the actual plugin otherwise.
    // This is not ideal, however unfortunately currently there is no supported way for updating the plugin state.
    window.location.reload();
  } catch (e) {
    console.error('Error while updating the plugin', e);
  }
};

export const updatePlugin = async (pluginId: string, data: Partial<PluginMeta>) => {
  const response = await getBackendSrv().datasourceRequest({
    url: `/api/plugins/${pluginId}/settings`,
    method: 'POST',
    data,
  });

  return response?.data;
};
