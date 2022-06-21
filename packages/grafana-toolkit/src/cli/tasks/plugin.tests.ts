import { testPlugin, PluginTestOptions } from './plugin/tests';
import { Task, TaskRunner } from './task';

const pluginTestRunner: TaskRunner<PluginTestOptions> = async (options) => {
  await testPlugin(options);
};

export const pluginTestTask = new Task<PluginTestOptions>('Test plugin', pluginTestRunner);
