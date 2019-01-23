// Services
export { ValidationSrv } from './services/ValidationSrv';

// Components
export * from './components/MoveToFolderModal';
export * from './components/UploadDashboard';

// Controllers
import { DashboardListCtrl } from './DashboardListCtrl';
import { SnapshotListCtrl } from './SnapshotListCtrl';
import { DashboardImportCtrl } from './DashboardImportCtrl';

import coreModule from 'app/core/core_module';

coreModule.controller('DashboardListCtrl', DashboardListCtrl);
coreModule.controller('SnapshotListCtrl', SnapshotListCtrl);
coreModule.controller('DashboardImportCtrl', DashboardImportCtrl);
