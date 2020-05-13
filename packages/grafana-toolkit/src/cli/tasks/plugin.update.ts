import { Task, TaskRunner } from './task';
import { useSpinner } from '../utils/useSpinner';
import fs = require('fs');
import path = require('path');

interface UpdatePluginTask {}

const updateCiConfig = useSpinner<any>('Updating CircleCI config', async () => {
  const ciConfigPath = path.join(process.cwd(), '.circleci');
  if (!fs.existsSync(ciConfigPath)) {
    fs.mkdirSync(ciConfigPath);
  }

  const sourceFile = path.join('node_modules/@grafana/toolkit/config/circleci', 'config.yml');
  const destFile = path.join(ciConfigPath, 'config.yml');
  fs.copyFileSync(sourceFile, destFile);
});

const pluginUpdateRunner: TaskRunner<UpdatePluginTask> = async () => {
  await updateCiConfig({});
};

export const pluginUpdateTask = new Task<UpdatePluginTask>('Update Plugin', pluginUpdateRunner);
