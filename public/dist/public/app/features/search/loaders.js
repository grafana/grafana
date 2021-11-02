import { backendSrv } from 'app/core/services/backend_srv';
import { buildNavModel } from '../folders/state/navModel';
export var loadFolderPage = function (uid) {
    return backendSrv.getFolderByUid(uid).then(function (folder) {
        var navModel = buildNavModel(folder);
        navModel.children[0].active = true;
        return { folder: folder, folderNav: navModel };
    });
};
//# sourceMappingURL=loaders.js.map