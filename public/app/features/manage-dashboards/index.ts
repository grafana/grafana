// Services
export { ValidationSrv } from './services/ValidationSrv';

// Components
export * from './components/MoveToFolderModal';
export * from './components/UploadDashboard';

// Controllers
import { DashboardListCtrl } from './DashboardListCtrl';
import { SnapshotListCtrl } from './SnapshotListCtrl';
import { FolderDashboardsCtrl } from './FolderDashboardsCtrl';
import { DashboardImportCtrl } from './DashboardImportCtrl';
import { CreateFolderCtrl } from './CreateFolderCtrl';

import coreModule from 'app/core/core_module';

coreModule.controller('DashboardListCtrl', DashboardListCtrl);
coreModule.controller('SnapshotListCtrl', SnapshotListCtrl);
coreModule.controller('FolderDashboardsCtrl', FolderDashboardsCtrl);
coreModule.controller('DashboardImportCtrl', DashboardImportCtrl);
coreModule.controller('CreateFolderCtrl', CreateFolderCtrl);
