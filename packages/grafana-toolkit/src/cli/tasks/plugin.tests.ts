import { Task, TaskRunner } from './task';
// @ts-ignore
import execa = require('execa');
import { useSpinner } from '../utils/useSpinner';
import { testPlugin } from './plugin/test';

interface PluginTestOptions {}

const pluginTestRunner: TaskRunner<PluginTestOptions> = async () => {
  await testPlugin();
};

export const pluginTestTask = new Task<PluginTestOptions>('Test plugin', pluginTestRunner);
