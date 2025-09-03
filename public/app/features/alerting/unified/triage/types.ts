import { EmbeddedScene } from '@grafana/scenes';

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
  timeline: TimelineEntry[];
  rowSummaryScene: EmbeddedScene;
  rows: unknown[];
}

export interface GenericGroupedRow {
  metadata: {
    label: string;
    value: string;
  };
  rows: WorkbenchRow[];
}

export interface AlertRuleQueryData {
  key: string;
  queries: Array<{
    refId: string;
    expr: string;
    instant: boolean;
    datasource: {
      type: string;
      uid: string;
    };
    format: string;
  }>;
  datasource: {
    type: string;
    uid: string;
  };
  data: {
    state: string;
    series: Array<{
      refId: string;
      fields: Array<{
        name: string;
        type: string;
        config: Record<string, any>;
        values: any[];
        state: any;
      }>;
      meta: {
        type: string;
        typeVersion: number[];
        custom: Record<string, any>;
        executedQueryString: string;
        preferredVisualisationType: string;
      };
      length: number;
    }>;
    annotations: any[];
    request: {
      app: string;
      requestId: string;
      timezone: string;
      range: {
        to: string;
        from: string;
        raw: {
          from: string;
          to: string;
        };
      };
      interval: string;
      intervalMs: number;
      targets: Array<{
        refId: string;
        expr: string;
        instant: boolean;
        datasource: {
          type: string;
          uid: string;
        };
        format: string;
      }>;
      maxDataPoints: number;
      scopedVars: Record<
        string,
        {
          text: string;
          value?: any;
        }
      >;
      startTime: number;
      rangeRaw: {
        from: string;
        to: string;
      };
      endTime: number;
    };
    timeRange: {
      to: string;
      from: string;
      raw: {
        from: string;
        to: string;
      };
    };
    timings: {
      dataProcessingTime: number;
    };
  };
}
