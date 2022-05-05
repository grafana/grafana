import fs = require('fs');
import path = require('path');

import { useSpinner } from '../utils/useSpinner';

import { Task, TaskRunner } from './task';

interface UpdatePluginTask {}

const updateCiConfig = () =>
  useSpinner('Updating CircleCI config', async () => {
    const ciConfigPath = path.join(process.cwd(), '.circleci');
    if (!fs.existsSync(ciConfigPath)) {
      fs.mkdirSync(ciConfigPath);
    }

    const sourceFile = require.resolve('@grafana/toolkit/config/circleci/config.yml');
    const destFile = path.join(ciConfigPath, 'config.yml');
    fs.copyFileSync(sourceFile, destFile);
  });

const pluginUpdateRunner: TaskRunner<UpdatePluginTask> = () => updateCiConfig();

export const pluginUpdateTask = new Task<UpdatePluginTask>('Update Plugin', pluginUpdateRunner);
