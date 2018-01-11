import { types, getEnv, flow } from 'mobx-state-tree';

export const Folder = types.model('Folder', {
  id: types.identifier(types.number),
  slug: types.string,
  title: types.string,
  canSave: types.boolean,
  hasChanged: types.boolean,
});

export const FolderStore = types
  .model('FolderStore', {
    folder: types.maybe(Folder),
  })
  .actions(self => ({
    load: flow(function* load(slug: string) {
      const backendSrv = getEnv(self).backendSrv;
      const res = yield backendSrv.getDashboard('db', slug);
      self.folder = Folder.create({
        id: res.dashboard.id,
        title: res.dashboard.title,
        slug: res.meta.slug,
        canSave: res.meta.canSave,
        hasChanged: false,
      });
      return res;
    }),
    setTitle: function(originalTitle: string, title: string) {
      self.folder.title = title;
      self.folder.hasChanged = originalTitle.toLowerCase() !== title.trim().toLowerCase() && title.trim().length > 0;
    },
    saveDashboard: flow(function* saveDashboard(dashboard: any, options: any) {
      const backendSrv = getEnv(self).backendSrv;
      dashboard.title = self.folder.title.trim();

      const res = yield backendSrv.saveDashboard(dashboard, options);
      self.folder.slug = res.slug;
      return `dashboards/folder/${self.folder.id}/${res.slug}/settings`;
    }),
    deleteFolder: flow(function* deleteFolder() {
      const backendSrv = getEnv(self).backendSrv;

      return backendSrv.deleteDashboard(self.folder.slug);
    }),
  }));
