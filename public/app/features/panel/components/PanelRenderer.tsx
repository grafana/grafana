import { useState, useMemo, useEffect } from 'react';

import {
  FieldConfigSource,
  getTimeZone,
  PanelPlugin,
  PluginContextProvider,
  getPanelOptionsWithDefaults,
  OptionDefaults,
  useFieldOverrides,
} from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { getTemplateSrv, PanelRendererProps } from '@grafana/runtime';
import { ErrorBoundaryAlert, useTheme2 } from '@grafana/ui';
import { appEvents } from 'app/core/core';

import { importPanelPlugin, syncGetPanelPlugin } from '../../plugins/importPanelPlugin';

const defaultFieldConfig = { defaults: {}, overrides: [] };

export function PanelRenderer<P extends object = {}, F extends object = {}>(props: PanelRendererProps<P, F>) {
  const {
    pluginId,
    data,
    timeZone = getTimeZone(),
    options = {},
    width,
    height,
    title,
    onOptionsChange = () => {},
    onChangeTimeRange = () => {},
    onFieldConfigChange = () => {},
    fieldConfig = defaultFieldConfig,
  } = props;

  const theme = useTheme2();
  const templateSrv = getTemplateSrv();
  const replace = useMemo(() => templateSrv.replace.bind(templateSrv), [templateSrv]);
  const [plugin, setPlugin] = useState(syncGetPanelPlugin(pluginId));
  const [error, setError] = useState<string | undefined>();
  const optionsWithDefaults = useOptionDefaults(plugin, options, fieldConfig);
  const dataWithOverrides = useFieldOverrides(plugin, optionsWithDefaults?.fieldConfig, data, timeZone, theme, replace);

  useEffect(() => {
    // If we already have a plugin and it's correct one do nothing
    if (plugin && plugin.hasPluginId(pluginId)) {
      return;
    }

    // Async load the plugin
    importPanelPlugin(pluginId)
      .then((result) => setPlugin(result))
      .catch((err: Error) => {
        setError(err.message);
      });
  }, [pluginId, plugin]);

  if (error) {
    return (
      <div>
        <Trans i18nKey="panel.panel-renderer.failed-to-load-plugin">Failed to load plugin: {{ error }}</Trans>
      </div>
    );
  }

  if (!plugin || !plugin.hasPluginId(pluginId)) {
    return (
      <div>
        <Trans i18nKey="panel.panel-renderer.loading-plugin-panel">Loading plugin panel...</Trans>
      </div>
    );
  }

  if (!plugin.panel) {
    return (
      <div>
        <Trans i18nKey="panel.panel-renderer.no-panel-component">
          Seems like the plugin you are trying to load does not have a panel component.
        </Trans>
      </div>
    );
  }

  if (!dataWithOverrides) {
    return (
      <div>
        <Trans i18nKey="panel.panel-renderer.no-panel-data">No panel data</Trans>
      </div>
    );
  }

  const PanelComponent = plugin.panel;

  return (
    <ErrorBoundaryAlert dependencies={[plugin, data]}>
      <PluginContextProvider meta={plugin.meta}>
        <PanelComponent
          id={1}
          data={dataWithOverrides}
          title={title}
          timeRange={dataWithOverrides.timeRange}
          timeZone={timeZone}
          options={optionsWithDefaults!.options}
          fieldConfig={fieldConfig}
          transparent={false}
          width={width}
          height={height}
          renderCounter={0}
          replaceVariables={(str: string) => str}
          onOptionsChange={onOptionsChange}
          onFieldConfigChange={onFieldConfigChange}
          onChangeTimeRange={onChangeTimeRange}
          eventBus={appEvents}
        />
      </PluginContextProvider>
    </ErrorBoundaryAlert>
  );
}

function useOptionDefaults<P extends Record<string, unknown> = {}, F extends object = {}>(
  plugin: PanelPlugin | undefined,
  options: P,
  fieldConfig: FieldConfigSource<F>
): OptionDefaults | undefined {
  return useMemo(() => {
    if (!plugin) {
      return;
    }

    return getPanelOptionsWithDefaults({
      plugin,
      currentOptions: options,
      currentFieldConfig: fieldConfig,
      isAfterPluginChange: false,
    });
  }, [plugin, fieldConfig, options]);
}
