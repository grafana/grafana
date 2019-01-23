import './dashboard_ctrl';
import './alerting_srv';
import './dashboard_loader_srv';
import './submenu/submenu';
import './save_as_modal';
import './save_modal';
import './save_provisioned_modal';
import './shareModalCtrl';
import './share_snapshot_ctrl';
import './dashboard_srv';
import './view_state_srv';
import './validation_srv';
import './time_srv';
import './unsaved_changes_srv';
import './unsaved_changes_modal';
import './timepicker/timepicker';
import './upload';
import './ad_hoc_filters';
import './repeat_option/repeat_option';
import './dashgrid/DashboardGridDirective';
import './dashgrid/RowOptions';
import './settings/settings';
import './panellinks/module';
import './components/DashLinks';
import './components/DashExportModal';
import './components/DashNav';
import './components/ExportDataModal';
import './components/FolderPicker';
import './components/VersionHistory';

// angular wrappers
import { react2AngularDirective } from 'app/core/utils/react2angular';
import DashboardPermissions from './permissions/DashboardPermissions';

react2AngularDirective('dashboardPermissions', DashboardPermissions, ['dashboardId', 'folder']);

