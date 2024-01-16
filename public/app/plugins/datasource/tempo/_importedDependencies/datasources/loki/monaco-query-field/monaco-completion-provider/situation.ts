export type LabelOperator = '=' | '!=' | '=~' | '!~';

export type Label = {
  name: string;
  value: string;
  op: LabelOperator;
};

export type Situation =
  | {
      type: 'EMPTY';
    }
  | {
      type: 'AT_ROOT';
    }
  | {
      type: 'IN_LOGFMT';
      otherLabels: string[];
      flags: boolean;
      trailingSpace: boolean;
      trailingComma: boolean;
      logQuery: string;
    }
  | {
      type: 'IN_RANGE';
    }
  | {
      type: 'IN_AGGREGATION';
    }
  | {
      type: 'IN_GROUPING';
      logQuery: string;
    }
  | {
      type: 'IN_LABEL_SELECTOR_NO_LABEL_NAME';
      otherLabels: Label[];
    }
  | {
      type: 'IN_LABEL_SELECTOR_WITH_LABEL_NAME';
      labelName: string;
      betweenQuotes: boolean;
      otherLabels: Label[];
    }
  | {
      type: 'AFTER_SELECTOR';
      afterPipe: boolean;
      hasSpace: boolean;
      logQuery: string;
    }
  | {
      type: 'AFTER_UNWRAP';
      logQuery: string;
    }
  | {
      type: 'AFTER_KEEP_AND_DROP';
      logQuery: string;
    };

/**
 * THIS METHOD IS KNOWN TO BE INCOMPLETE due to the decoupling of the Tempo datasource from Grafana core:
 * Incomplete support for LogQL autocomplete from 'public/app/plugins/datasource/loki/components/monaco-query-field/monaco-completion-provider/situation.ts';
 */
export const getSituation = (text: string, pos: number): Situation | null => {
  return {
    type: 'EMPTY',
  };
};
