import './dashgrid/DashboardGridDirective';

// Services
import './services/UnsavedChangesSrv';
import './services/DashboardLoaderSrv';
import './services/DashboardSrv';

// Components
import './components/DashLinks';
import './components/DashExportModal';
import './components/DashNav';
import './components/ExportDataModal';
import './components/FolderPicker';
import './components/VersionHistory';
import './components/DashboardSettings';
import './components/SubMenu';
import './components/TimePicker';
import './components/UnsavedChangesModal';
import './components/SaveModals';
import './components/ShareModal';
import './components/AdHocFilters';
import './components/RowOptions';

import DashboardPermissions from './components/DashboardPermissions/DashboardPermissions';

// angular wrappers
import { react2AngularDirective } from 'app/core/utils/react2angular';

react2AngularDirective('dashboardPermissions', DashboardPermissions, ['dashboardId', 'folder']);
