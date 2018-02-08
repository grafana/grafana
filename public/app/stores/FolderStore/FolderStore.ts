import { types, getEnv, flow } from 'mobx-state-tree';

export const Folder = types.model('Folder', {
  id: types.identifier(types.number),
  title: types.string,
  url: types.string,
  canSave: types.boolean,
  uid: types.string,
  hasChanged: types.boolean,
});

export const FolderStore = types
  .model('FolderStore', {
    folder: types.maybe(Folder),
  })
  .actions(self => ({
    load: flow(function* load(uid: string) {
      // clear folder state
      if (self.folder && self.folder.uid !== uid) {
        self.folder = null;
      }

      const backendSrv = getEnv(self).backendSrv;
      const res = yield backendSrv.getDashboardByUid(uid);

      self.folder = Folder.create({
        id: res.dashboard.id,
        title: res.dashboard.title,
        url: res.meta.url,
        uid: res.dashboard.uid,
        canSave: res.meta.canSave,
        hasChanged: false,
      });

      return res;
    }),

    setTitle: function(originalTitle: string, title: string) {
      self.folder.title = title;
      self.folder.hasChanged = originalTitle.toLowerCase() !== title.trim().toLowerCase() && title.trim().length > 0;
    },

    saveFolder: flow(function* saveFolder(dashboard: any, options: any) {
      const backendSrv = getEnv(self).backendSrv;
      dashboard.title = self.folder.title.trim();

      const res = yield backendSrv.saveFolder(dashboard, options);
      self.folder.url = res.url;

      return `${self.folder.url}/settings`;
    }),

    deleteFolder: flow(function* deleteFolder() {
      const backendSrv = getEnv(self).backendSrv;

      return backendSrv.deleteDashboard(self.folder.uid);
    }),
  }));
