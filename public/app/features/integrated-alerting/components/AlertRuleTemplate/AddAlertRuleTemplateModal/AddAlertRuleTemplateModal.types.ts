export interface AddAlertRuleTemplateModalProps {
  isVisible: boolean;
  setVisible: (value: boolean) => void;
}

export interface AlertRuleTemplateRenderProps {
  yaml: string;
}
