import './dashboard_ctrl';
import './dashboard_loader_srv';
import './save_as_modal';
import './save_modal';
import './save_provisioned_modal';
import './shareModalCtrl';
import './share_snapshot_ctrl';
import './dashboard_srv';
import './validation_srv';
import './time_srv';
import './unsaved_changes_srv';
import './unsaved_changes_modal';
import './upload';
import './ad_hoc_filters';
import './repeat_option/repeat_option';
import './dashgrid/DashboardGridDirective';
import './dashgrid/RowOptions';
import './panellinks/module';

// Services
import './services/DashboardViewStateSrv';

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
import DashboardPermissions from './components/DashboardPermissions/DashboardPermissions';

// angular wrappers
import { react2AngularDirective } from 'app/core/utils/react2angular';

react2AngularDirective('dashboardPermissions', DashboardPermissions, ['dashboardId', 'folder']);

