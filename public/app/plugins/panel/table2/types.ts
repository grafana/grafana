// Made to match the existing (untyped) settings in the angular table
export interface Style {
  alias?: string;
  colorMode?: string;
  colors?: any[];
  decimals?: number;
  pattern?: string;
  thresholds?: any[];
  type?: 'date' | 'number' | 'string' | 'hidden';
  unit?: string;
  dateFormat?: string;
  sanitize?: boolean;
  mappingType?: any;
  valueMaps?: any;
  rangeMaps?: any;

  link?: any;
  linkUrl?: any;
  linkTooltip?: any;
  linkTargetBlank?: boolean;

  preserveFormat?: boolean;
}

export type CellFormatter = (v: any, style: Style) => string;

export interface ColumnInfo {
  header: string;
  accessor: string; // the field name
  style?: Style;
  hidden?: boolean;
  formatter: CellFormatter;
  filterable?: boolean;
}

export interface Options {
  showHeader: boolean;
  styles: Style[];
  pageSize: number;
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
  pageSize: 100,
};
