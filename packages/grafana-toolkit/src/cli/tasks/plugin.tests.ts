import { Task, TaskRunner } from './task';
import { testPlugin } from './plugin/tests';

interface PluginTestOptions {}

const pluginTestRunner: TaskRunner<PluginTestOptions> = async () => {
  await testPlugin();
};

export const pluginTestTask = new Task<PluginTestOptions>('Test plugin', pluginTestRunner);
