import { Task, TaskRunner } from '../task';
import { restoreCwd } from '../../utils/cwd';
import execa = require('execa');
const fs = require('fs');
const util = require('util');

const readdirPromise = util.promisify(fs.readdir);

interface BundeManagedOptions {}

const MANAGED_PLUGINS_PATH = `${process.cwd()}/plugins-bundled`;
const MANAGED_PLUGINS_SCOPES = ['internal', 'external'];

const bundleManagedPluginsRunner: TaskRunner<BundeManagedOptions> = async () => {
  await Promise.all(
    MANAGED_PLUGINS_SCOPES.map(async scope => {
      try {
        const plugins = await readdirPromise(`${MANAGED_PLUGINS_PATH}/${scope}`);
        if (plugins.length > 0) {
          for (const plugin of plugins) {
            process.chdir(`${MANAGED_PLUGINS_PATH}/${scope}/${plugin}`);
            try {
              console.log(`[${scope}]: ${plugin} building...`);
              await execa('yarn', ['build']);
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
  restoreCwd();
};

export const bundleManagedTask = new Task<BundeManagedOptions>('Bundle managed plugins', bundleManagedPluginsRunner);
