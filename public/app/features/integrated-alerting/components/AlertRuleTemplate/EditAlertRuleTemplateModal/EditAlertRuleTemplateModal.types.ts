export interface EditAlertRuleTemplateModalProps {
  yaml: string;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  getAlertRuleTemplates: () => void;
}

export interface EditAlertRuleTemplateRenderProps {
  yaml: string;
}
