export type Domain = [Date, Date];
export type Filter = [key: string, operator: '=' | '=!', value: string];

export type WorkbenchRow = GenericGroupedRow | AlertRuleRow;

export type TimelineEntry = [timestamp: number, state: 'firing' | 'pending'];

export interface AlertRuleRow {
  type: 'alertRule';
  metadata: {
    title: string;
    folder: string;
    ruleUID: string;
  };
}

export interface GenericGroupedRow {
  type: 'group';
  metadata: {
    label: string;
    value: LabelValue;
  };
  rows: WorkbenchRow[];
}

export type LabelValue = string | typeof EmptyLabelValue;
export const EmptyLabelValue = Symbol('empty label value');
