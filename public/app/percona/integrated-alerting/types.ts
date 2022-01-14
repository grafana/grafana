import { CSSProperties } from 'react';

export interface UploadAlertRuleTemplatePayload {
  yaml: string;
}

declare module 'react-table' {
  interface Row {
    isExpanded: boolean;
    getToggleRowExpandedProps?: () => void;
  }

  interface HeaderGroup {
    className?: string;
    style?: CSSProperties;
  }

  interface ColumnInstance {
    className?: string;
    style?: CSSProperties;
  }
}
