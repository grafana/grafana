export * from './components/MoveToFolderModal';

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
