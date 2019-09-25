import TimeSeries from 'app/core/time_series2';
import TableModel from 'app/core/table_model';
import { eventFactory } from '@grafana/data';

export const rendered = eventFactory<TableModel | TimeSeries[]>('render');
