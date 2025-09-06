export type Domain = [Date, Date];
export type Filter = [key: string, operator: '=' | '=!', value: string];

export type WorkbenchRow = GenericGroupedRow | AlertRuleRow;

export type TimelineEntry = [timestamp: number, state: 'firing' | 'pending'];

export interface AlertRuleRow {
  metadata: {
    title: string;
    folder: string;
    ruleUID: string;
  };
}

export interface GenericGroupedRow {
  metadata: {
    label: string;
    value: string;
  };
  rows: WorkbenchRow[];
}
