import { Branding } from 'app/core/components/Branding/Branding';
import { CombinedRule } from 'app/types/unified-alerting';

export function useRuleViewerPageTitle(rule: CombinedRule | undefined) {
  if (!rule) {
    return;
  }

  document.title = `${rule.name} - Alerting - ${Branding.AppTitle}`;
}
