import TimeSeries from 'app/core/time_series2';
import TableModel from 'app/core/table_model';
import { eventFactory } from '@grafana/data';
import { DashboardModel } from 'app/features/dashboard/state';

export const rendered = eventFactory<TableModel | TimeSeries[]>('render');
export const dashboardSaved = eventFactory<DashboardModel>('dashboard-saved');
