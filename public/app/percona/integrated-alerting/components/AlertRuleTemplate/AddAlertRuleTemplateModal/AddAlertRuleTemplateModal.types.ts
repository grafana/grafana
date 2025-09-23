export interface AddAlertRuleTemplateModalProps {
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  getAlertRuleTemplates: () => void;
}

export interface AlertRuleTemplateRenderProps {
  yaml: string;
}
