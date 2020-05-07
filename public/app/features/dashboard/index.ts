// Services
import './services/UnsavedChangesSrv';
import './services/DashboardLoaderSrv';
import './services/DashboardSrv';

// Components
import './components/DashLinks';
import './components/DashExportModal';
import './components/DashNav';
import './components/VersionHistory';
import './components/DashboardSettings';
import './components/AdHocFilters';
import './components/RowOptions';

import DashboardPermissions from './components/DashboardPermissions/DashboardPermissions';

// angular wrappers
import { react2AngularDirective } from 'app/core/utils/react2angular';

react2AngularDirective('dashboardPermissions', DashboardPermissions, ['dashboardId', 'folder']);
