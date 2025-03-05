import React, { useContext } from 'react';
import { AppRootProps } from '@grafana/data';

// This is used to be able to retrieve the root plugin props anywhere inside the app.
export const PluginPropsContext = React.createContext<AppRootProps | null>(null);

export const usePluginProps = () => {
  const pluginProps = useContext(PluginPropsContext);

  return pluginProps;
};

export const usePluginMeta = () => {
  const pluginProps = usePluginProps();

  return pluginProps?.meta;
};
