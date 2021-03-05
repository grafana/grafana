export interface EditAlertRuleTemplateModalProps {
  yaml: string;
  name: string;
  summary: string;
  isVisible: boolean;
  setVisible: (value: boolean) => void;
  getAlertRuleTemplates: () => void;
}

export interface EditAlertRuleTemplateRenderProps {
  yaml: string;
}
