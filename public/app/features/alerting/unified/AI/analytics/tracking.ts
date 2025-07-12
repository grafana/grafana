import { reportInteraction } from '@grafana/runtime';

// AI Alert Rule Tracking
export const trackAIAlertRuleButtonClick = () => {
  reportInteraction('grafana_alerting_ai_alert_rule_button_click');
};

export const trackAIAlertRuleGeneration = (props: { success: boolean; hasTools?: boolean; error?: string }) => {
  reportInteraction('grafana_alerting_ai_alert_rule_generation', props);
};

export const trackAIAlertRuleUsed = () => {
  reportInteraction('grafana_alerting_ai_alert_rule_used');
};

export const trackAIAlertRuleCancelled = () => {
  reportInteraction('grafana_alerting_ai_alert_rule_cancelled');
};

// AI Template Tracking
export const trackAITemplateButtonClick = () => {
  reportInteraction('grafana_alerting_ai_template_button_click');
};

export const trackAITemplateGeneration = (props: { success: boolean; error?: string }) => {
  reportInteraction('grafana_alerting_ai_template_generation', props);
};

export const trackAITemplateUsed = () => {
  reportInteraction('grafana_alerting_ai_template_used');
};

export const trackAITemplateCancelled = () => {
  reportInteraction('grafana_alerting_ai_template_cancelled');
};

// AI Improve Labels Tracking
export const trackAIImproveLabelsButtonClick = () => {
  reportInteraction('grafana_alerting_ai_improve_labels_button_click');
};

export const trackAIImproveLabelsGeneration = (props: { success: boolean; error?: string }) => {
  reportInteraction('grafana_alerting_ai_improve_labels_generation', props);
};

export const trackAIImproveLabelsApplied = () => {
  reportInteraction('grafana_alerting_ai_improve_labels_applied');
};

export const trackAIImproveLabelsCancel = () => {
  reportInteraction('grafana_alerting_ai_improve_labels_cancelled');
};

// AI Improve Annotations Tracking
export const trackAIImproveAnnotationsButtonClick = () => {
  reportInteraction('grafana_alerting_ai_improve_annotations_button_click');
};

export const trackAIImproveAnnotationsGeneration = (props: { success: boolean; error?: string }) => {
  reportInteraction('grafana_alerting_ai_improve_annotations_generation', props);
};

export const trackAIImproveAnnotationsApplied = () => {
  reportInteraction('grafana_alerting_ai_improve_annotations_applied');
};

export const trackAIImproveAnnotationsCancel = () => {
  reportInteraction('grafana_alerting_ai_improve_annotations_cancelled');
};

// AI Triage Tracking
export const trackAITriageButtonClick = () => {
  reportInteraction('grafana_alerting_ai_triage_button_click');
};

export const trackAITriageGeneration = (props: { success: boolean; logRecordsCount?: number; error?: string }) => {
  reportInteraction('grafana_alerting_ai_triage_generation', props);
};
