import React from 'react';
import { PluginConfigPageProps, AppPluginMeta } from '@grafana/data';
import { CatalogAppSettings } from 'types';
import { LinkButton } from '@grafana/ui';
import { PLUGIN_ROOT } from '../constants';
import { config } from '@grafana/runtime';

interface Props extends PluginConfigPageProps<AppPluginMeta<CatalogAppSettings>> {}

export const Settings = ({ plugin }: Props) => {
  if (!config.pluginAdminEnabled) {
    return <div>Plugin admin is not enabled.</div>;
  }

  return (
    <>
      <LinkButton href={PLUGIN_ROOT}>Manage plugins</LinkButton>
    </>
  );
};
