export interface UploadAlertRuleTemplatePayload {
  yaml: string;
}

declare module 'react-table' {
  interface Row {
    isExpanded: boolean;
    getToggleRowExpandedProps?: () => void;
  }
}
