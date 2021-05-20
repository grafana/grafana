import { AppPlugin } from '@grafana/data';
import { Settings } from './config/Settings';
import { CatalogRootPage } from './RootPage';

export const plugin = new AppPlugin().setRootPage(CatalogRootPage as any).addConfigPage({
  title: 'Settings',
  icon: 'info-circle',
  body: Settings as any,
  id: 'settings',
});
