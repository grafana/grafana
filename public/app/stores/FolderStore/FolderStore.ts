import { types, getEnv, flow } from 'mobx-state-tree';

export const Folder = types.model('Folder', {
  id: types.identifier(types.number),
  uid: types.string,
  title: types.string,
  url: types.string,
  canSave: types.boolean,
  hasChanged: types.boolean,
  version: types.number,
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
      const res = yield backendSrv.getFolderByUid(uid);
      self.folder = Folder.create({
        id: res.id,
        uid: res.uid,
        title: res.title,
        url: res.url,
        canSave: res.canSave,
        hasChanged: false,
        version: res.version,
      });

      return res;
    }),

    setTitle: function(originalTitle: string, title: string) {
      self.folder.title = title;
      self.folder.hasChanged = originalTitle.toLowerCase() !== title.trim().toLowerCase() && title.trim().length > 0;
    },

    saveFolder: flow(function* saveFolder(options: any) {
      const backendSrv = getEnv(self).backendSrv;
      self.folder.title = self.folder.title.trim();

      const res = yield backendSrv.updateFolder(self.folder, options);
      self.folder.url = res.url;
      self.folder.version = res.version;

      return `${self.folder.url}/settings`;
    }),

    deleteFolder: flow(function* deleteFolder() {
      const backendSrv = getEnv(self).backendSrv;

      return backendSrv.deleteFolder(self.folder.uid);
    }),
  }));
