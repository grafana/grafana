import { ColumnStyle } from '@grafana/ui/src/components/Table/TableCellBuilder';
import { SingleStatBaseOptions } from '@grafana/ui';
import { standardFieldDisplayOptions } from '../singlestat2/types';
import { FieldDisplayOptions, VizOrientation } from '@grafana/data';

export interface TablePanelOptions extends SingleStatBaseOptions {
  showHeader: boolean;
  fixedHeader: boolean;
  fixedColumns: number;
  rotate: boolean;

  styles: ColumnStyle[]; // matcher + config?
}

export const standardTableFieldOptions: FieldDisplayOptions = {
  ...standardFieldDisplayOptions,
};

export const defaults: TablePanelOptions = {
  fieldOptions: standardTableFieldOptions,
  orientation: VizOrientation.Auto, // :(

  showHeader: true,
  fixedHeader: true,
  fixedColumns: 0,
  rotate: false,
  styles: [
    {
      type: 'date',
      pattern: 'Time',
      alias: 'Time',
      dateFormat: 'YYYY-MM-DD HH:mm:ss',
    },
    {
      unit: 'short',
      type: 'number',
      alias: '',
      decimals: 2,
      colors: ['rgba(245, 54, 54, 0.9)', 'rgba(237, 129, 40, 0.89)', 'rgba(50, 172, 45, 0.97)'],
      pattern: '/.*/',
      thresholds: [],
    },
  ],
};
