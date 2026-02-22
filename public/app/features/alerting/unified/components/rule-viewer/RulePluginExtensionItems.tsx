import { Menu } from '@grafana/ui';
import { RuleGroupIdentifierV2 } from 'app/types/unified-alerting';
import { PromRuleCompact } from 'app/types/unified-alerting-dto';

import { useRulePluginLinkExtension } from '../../plugins/useRulePluginLinkExtensions';

interface RulePluginExtensionItemsProps {
  promRule?: PromRuleCompact;
  groupIdentifier: RuleGroupIdentifierV2;
}

export function RulePluginExtensionItems({ promRule, groupIdentifier }: RulePluginExtensionItemsProps) {
  const ruleExtensionLinks = useRulePluginLinkExtension(promRule, groupIdentifier);

  const extensionsAvailable = ruleExtensionLinks.length > 0;

  if (!extensionsAvailable) {
    return null;
  }

  return (
    <>
      <Menu.Divider />
      {ruleExtensionLinks.map((extension) => (
        <Menu.Item key={extension.id} label={extension.title} icon={extension.icon} onClick={extension.onClick} />
      ))}
    </>
  );
}
