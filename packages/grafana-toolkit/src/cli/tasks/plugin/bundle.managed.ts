import { promises as fs } from 'fs';
import { Task, TaskRunner } from '../task';
import execa = require('execa');

interface BundeManagedOptions {}

const MANAGED_PLUGINS_PATH = `${process.cwd()}/plugins-bundled`;
const MANAGED_PLUGINS_SCOPES = ['internal', 'external'];

const bundleManagedPluginsRunner: TaskRunner<BundeManagedOptions> = async () => {
  await Promise.all(
    MANAGED_PLUGINS_SCOPES.map(async scope => {
      try {
        const plugins = await fs.readdir(`${MANAGED_PLUGINS_PATH}/${scope}`);
        if (plugins.length > 0) {
          for (const plugin of plugins) {
            try {
              console.log(`[${scope}]: ${plugin} building...`);
              await execa('yarn', ['build'], { cwd: `${MANAGED_PLUGINS_PATH}/${scope}/${plugin}` });
              console.log(`[${scope}]: ${plugin} bundled`);
            } catch (e) {
              console.log(e.stdout);
            }
          }
        }
      } catch (e) {
        console.log(e);
      }
    })
  );
};

export const bundleManagedTask = new Task<BundeManagedOptions>('Bundle managed plugins', bundleManagedPluginsRunner);
