import React from 'react';
import { applyFieldOverrides, getTimeZone } from '@grafana/data';
import { PanelRendererProps } from '@grafana/runtime';
import { config } from 'app/core/config';
import { appEvents } from 'app/core/core';
import { useAsync } from 'react-use';
import { getPanelOptionsWithDefaults } from '../dashboard/state/getPanelOptionsWithDefaults';
import { importPanelPlugin } from '../plugins/plugin_loader';

export function PanelRenderer<T = {}>(props: PanelRendererProps<T>) {
  const {
    pluginId,
    options = {},
    data,
    width,
    height,
    title,
    fieldConfig = { defaults: {}, overrides: [] },
    onOptionsChange,
  } = props;

  const timeZone = getTimeZone();
  const state = useAsync(() => importPanelPlugin(pluginId), [pluginId]);

  if (state.error) {
    return <div>Failed to load plugin</div>;
  }

  if (state.loading) {
    return <div>Loading plugin panel</div>;
  }

  if (!state.value) {
    return <div>Failed to load plugin</div>;
  }

  const plugin = state.value;

  if (!plugin.panel) {
    return <div>Seems like the plugin you are trying to load does not have a panel component.</div>;
  }

  const pluginOptions = getPanelOptionsWithDefaults({
    plugin,
    currentOptions: options,
    currentFieldConfig: fieldConfig,
    isAfterPluginChange: false,
  });

  const processedFrames = applyFieldOverrides({
    data: data.series,
    fieldConfig: pluginOptions.fieldConfig,
    fieldConfigRegistry: plugin.fieldConfigRegistry,
    replaceVariables: (str: string) => str, // panelmodel impl.
    theme: config.theme,
    timeZone,
  });

  const PanelComponent = plugin.panel;

  return (
    <PanelComponent
      id={1}
      data={{
        ...data,
        series: processedFrames,
      }}
      title={title}
      timeRange={data?.timeRange}
      timeZone={timeZone}
      options={options}
      fieldConfig={fieldConfig}
      transparent={false}
      width={width}
      height={height}
      renderCounter={0}
      replaceVariables={(str: string) => str}
      onOptionsChange={onOptionsChange}
      onFieldConfigChange={() => {}}
      onChangeTimeRange={() => {}}
      eventBus={appEvents}
    />
  );
}

// type UsePluginOptionsParams<T> = {
//   plugin: PanelPlugin | undefined;
//   options: Record<string, any>;
//   fieldConfig: FieldConfigSource<T>;
// };

// const usePluginOptions = <T,>(params: UsePluginOptionsParams<T>): OptionDefaults | undefined => {
//   const { plugin, fieldConfig, options } = params;

//   return useMemo(() => {
//     if (!plugin) {
//       return;
//     }

//     return getPanelOptionsWithDefaults({
//       plugin,
//       currentOptions: options,
//       currentFieldConfig: fieldConfig,
//       isAfterPluginChange: false,
//     });
//   }, [plugin, fieldConfig, options]);
// };

// export class PanelRenderer<T = {}> extends Component<PanelRendererProps<T>, State> {
//   state: State = {
//     options: {},
//   };

//   async componentDidMount() {
//     this.processOptionsAndData();
//   }

//   componentDidUpdate(prevProps: PanelRendererProps) {
//     if (this.props.data !== prevProps.data) {
//       this.processOptionsAndData();
//     }
//   }

//   async processOptionsAndData() {
//     const { pluginId, options, fieldConfig, data } = this.props;
//     const plugin = await importPanelPlugin(pluginId);

//     const pluginOptions = getPanelOptionsWithDefaults({
//       plugin,
//       currentOptions: options ?? {},
//       currentFieldConfig: fieldConfig ?? { defaults: {}, overrides: [] },
//       isAfterPluginChange: false,
//     });

//     const processedFrames = applyFieldOverrides({
//       data: data.series,
//       fieldConfig: pluginOptions.fieldConfig,
//       fieldConfigRegistry: plugin.fieldConfigRegistry,
//       replaceVariables: (str: string) => str,
//       theme: config.theme,
//       timeZone: contextSrv.user.timezone,
//     });

//     this.setState({
//       plugin,
//       options: pluginOptions.options,
//       fieldConfig: pluginOptions.fieldConfig,
//       processedData: {
//         ...data,
//         series: processedFrames,
//       },
//     });
//   }

//   render() {
//     const { plugin, processedData, options, fieldConfig } = this.state;
//     const { width, height } = this.props;

//     if (!plugin || !processedData || !fieldConfig) {
//       return null;
//     }

//     const PanelComponent = plugin.panel;
//     const dummyFunc = (() => {}) as any;

//     if (!PanelComponent) {
//       return null;
//     }

//     return (
//       <PanelComponent
//         id={1}
//         data={processedData}
//         title={''}
//         timeRange={processedData?.timeRange}
//         timeZone={contextSrv.user.timezone}
//         options={options}
//         fieldConfig={fieldConfig}
//         transparent={false}
//         width={width}
//         height={height}
//         renderCounter={0}
//         replaceVariables={(str: string) => str}
//         onOptionsChange={dummyFunc}
//         onFieldConfigChange={dummyFunc}
//         onChangeTimeRange={dummyFunc}
//         eventBus={appEvents}
//       />
//     );
//   }
// }
