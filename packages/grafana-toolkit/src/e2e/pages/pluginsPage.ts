import { TestPage } from '../pageInfo';

export interface PluginsPage {}

export const pluginsPage = new TestPage<PluginsPage>({
  url: '/plugins',
  pageObjects: {},
});

export function getPluginPage(id: string) {
  return new TestPage<PluginsPage>({
    url: `/plugins/${id}/`,
    pageObjects: {
      // TODO Find update/enable buttons
    },
  });
}
