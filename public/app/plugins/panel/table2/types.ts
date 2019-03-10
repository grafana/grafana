import { ColumnStyle } from '@grafana/ui/src/components/Table/TableCellBuilder';

export interface Options {
  showHeader: boolean;
  styles: ColumnStyle[];
}

export const defaults: Options = {
  showHeader: true,
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
      colorMode: null,
      pattern: '/.*/',
      thresholds: [],
    },
  ],
};
