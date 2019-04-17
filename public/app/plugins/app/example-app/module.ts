// Angular pages
import { ExampleConfigCtrl } from './legacy/config';
import { AngularExamplePageCtrl } from './legacy/angular_example_page';
import { AppPlugin } from '@grafana/ui';
import { ExampleConfigPage } from './config/ExampleConfigPage';
import { ExampleTab1 } from './config/ExampleTab1';
import { ExampleAppPage } from './page/ExampleAppPage';
import { ExampleTab2 } from './config/ExampleTab2';

// Legacy exports just for testing
export {
  ExampleConfigCtrl as ConfigCtrl,
  AngularExamplePageCtrl, // Must match `pages.component` in plugin.json
};

export const appPlugin = new AppPlugin()
  .setConfigPage({
    title: 'Config',
    icon: 'gicon gicon-cog',
    body: ExampleConfigPage,
  })
  .addConfigTab({
    title: 'Tab 1',
    icon: 'fa fa-info',
    body: ExampleTab1,
  })
  .addConfigTab({
    title: 'Tab 2',
    icon: 'fa fa-user',
    body: ExampleTab2,
  })
  .addPage({
    Body: ExampleAppPage,
  });

// Only for testing
appPlugin.angular = {
  ConfigCtrl: ExampleConfigCtrl,
  pages: {
    AngularExamplePageCtrl: AngularExamplePageCtrl,
  },
};
