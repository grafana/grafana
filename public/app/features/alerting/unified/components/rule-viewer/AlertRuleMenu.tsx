import React from 'react';

import { AppEvents } from '@grafana/data';
import { ComponentSize, Dropdown, Menu } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import MenuItemPauseRule from 'app/features/alerting/unified/components/MenuItemPauseRule';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { useRulePluginLinkExtension } from 'app/features/alerting/unified/plugins/useRulePluginLinkExtensions';
import { isAlertingRule } from 'app/features/alerting/unified/utils/rules';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';
import { PromAlertingRuleState } from 'app/types/unified-alerting-dto';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { createShareLink, isLocalDevEnv, isOpenSourceEdition } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { createUrl } from '../../utils/url';
import { DeclareIncidentMenuItem } from '../bridges/DeclareIncidentButton';

interface Props {
  rule: CombinedRule;
  identifier: RuleIdentifier;
  showCopyLinkButton?: boolean;
  handleSilence: () => void;
  handleDelete: (rule: CombinedRule) => void;
  handleDuplicateRule: (identifier: RuleIdentifier) => void;
  onPauseChange?: () => void;
  buttonSize?: ComponentSize;
  hideLabels?: boolean;
}

/**
 * Get a list of menu items + divider elements for rendering in an alert rule's
 * dropdown menu
 */
const AlertRuleMenu = ({
  rule,
  identifier,
  showCopyLinkButton,
  handleSilence,
  handleDelete,
  handleDuplicateRule,
  onPauseChange,
  buttonSize,
}: Props) => {
  // check all abilities and permissions
  const [pauseSupported, pauseAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Pause);
  const canPause = pauseSupported && pauseAllowed;

  const [deleteSupported, deleteAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Delete);
  const canDelete = deleteSupported && deleteAllowed;

  const [duplicateSupported, duplicateAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Duplicate);
  const canDuplicate = duplicateSupported && duplicateAllowed;

  const [silenceSupported, silenceAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Silence);
  const canSilence = silenceSupported && silenceAllowed;

  const [exportSupported, exportAllowed] = useAlertRuleAbility(rule, AlertRuleAction.ModifyExport);
  const canExport = exportSupported && exportAllowed;

  const ruleExtensionLinks = useRulePluginLinkExtension(rule);

  const extensionsAvailable = ruleExtensionLinks.length > 0;

  /**
   * Since Incident isn't available as an open-source product we shouldn't show it for Open-Source licenced editions of Grafana.
   * We should show it in development mode
   */
  const shouldShowDeclareIncidentButton =
    (!isOpenSourceEdition() || isLocalDevEnv()) &&
    isAlertingRule(rule.promRule) &&
    rule.promRule.state === PromAlertingRuleState.Firing;
  const shareUrl = createShareLink(rule.namespace.rulesSource, rule);

  const showDivider =
    [canPause, canSilence, shouldShowDeclareIncidentButton, canDuplicate].some(Boolean) &&
    [showCopyLinkButton, canExport].some(Boolean);

  const menuItems = (
    <>
      {canPause && <MenuItemPauseRule rule={rule} onPauseChange={onPauseChange} />}
      {canSilence && <Menu.Item label="Silence notifications" icon="bell-slash" onClick={handleSilence} />}
      {shouldShowDeclareIncidentButton && <DeclareIncidentMenuItem title={rule.name} url={''} />}
      {canDuplicate && <Menu.Item label="Duplicate" icon="copy" onClick={() => handleDuplicateRule(identifier)} />}
      {showDivider && <Menu.Divider />}
      {shareUrl && <Menu.Item label="Copy link" icon="share-alt" onClick={() => copyToClipboard(shareUrl)} />}
      {canExport && (
        <Menu.Item
          label="Export"
          icon="download-alt"
          childItems={[<ExportMenuItem key="export-with-modifications" identifier={identifier} />]}
        />
      )}
      {extensionsAvailable && (
        <>
          <Menu.Divider />
          {ruleExtensionLinks.map((extension) => (
            <Menu.Item key={extension.id} label={extension.title} icon={extension.icon} onClick={extension.onClick} />
          ))}
        </>
      )}
      {canDelete && (
        <>
          <Menu.Divider />
          <Menu.Item label="Delete" icon="trash-alt" destructive onClick={() => handleDelete(rule)} />
        </>
      )}
    </>
  );

  return (
    <Dropdown overlay={<Menu>{menuItems}</Menu>}>
      <MoreButton size={buttonSize} />
    </Dropdown>
  );
};

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).then(() => {
    appEvents.emit(AppEvents.alertSuccess, ['URL copied to clipboard']);
  });
}

type PropsWithIdentifier = { identifier: RuleIdentifier };

const ExportMenuItem = ({ identifier }: PropsWithIdentifier) => {
  const returnTo = location.pathname + location.search;
  const url = createUrl(`/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/modify-export`, {
    returnTo,
  });

  return <Menu.Item key="with-modifications" label="With modifications" icon="file-edit-alt" url={url} />;
};

export default AlertRuleMenu;
