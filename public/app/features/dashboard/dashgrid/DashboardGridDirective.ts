import { react2AngularDirective } from 'app/core/utils/react2angular';
import DashboardGrid from './DashboardGrid';

react2AngularDirective('dashboardGrid', DashboardGrid, [['dashboard', { watchDepth: 'reference' }]]);
