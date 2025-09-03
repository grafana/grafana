import { PropsOf } from '@emotion/react';

import { AppEvents } from '@grafana/data';
import { t } from '@grafana/i18n';
import { config, featureEnabled } from '@grafana/runtime';
import { Button, ComponentSize, Dropdown, Menu } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import MenuItemPauseRule from 'app/features/alerting/unified/components/MenuItemPauseRule';
import MoreButton from 'app/features/alerting/unified/components/MoreButton';
import { useRulePluginLinkExtension } from 'app/features/alerting/unified/plugins/useRulePluginLinkExtensions';
import { EditableRuleIdentifier, Rule, RuleGroupIdentifierV2, RuleIdentifier } from 'app/types/unified-alerting';
import { PromAlertingRuleState, RulerRuleDTO } from 'app/types/unified-alerting-dto';

import {
  AlertRuleAction,
  skipToken,
  useGrafanaPromRuleAbilities,
  useGrafanaPromRuleAbility,
  useRulerRuleAbilities,
  useRulerRuleAbility,
} from '../../hooks/useAbilities';
import { createShareLink, isLocalDevEnv, isOpenSourceEdition } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import {
  getRuleUID,
  isEditableRuleIdentifier,
  isPausedRule,
  prometheusRuleType,
  rulerRuleType,
} from '../../utils/rules';
import { createRelativeUrl } from '../../utils/url';
import { DeclareIncidentMenuItem } from '../bridges/DeclareIncidentButton';

interface Props {
  promRule?: Rule;
  rulerRule?: RulerRuleDTO;
  identifier: RuleIdentifier;
  groupIdentifier: RuleGroupIdentifierV2;
  handleSilence: () => void;
  handleManageEnrichments?: () => void;
  handleDelete: (identifier: EditableRuleIdentifier, groupIdentifier: RuleGroupIdentifierV2) => void;
  handleDuplicateRule: (identifier: RuleIdentifier) => void;
  onPauseChange?: () => void;
  buttonSize?: ComponentSize;
  fill?: PropsOf<typeof Button>['fill'];
}

/**
 * Get a list of menu items + divider elements for rendering in an alert rule's
 * dropdown menu
 * If the consumer of this component comes from the alert list view, we need to use promRule to check abilities and permissions,
 * as we have removed all requests to the ruler API in the list view.
 */
const AlertRuleMenu = ({
  promRule,
  rulerRule,
  identifier,
  groupIdentifier,
  handleSilence,
  handleManageEnrichments,
  handleDelete,
  handleDuplicateRule,
  onPauseChange,
  buttonSize,
  fill,
}: Props) => {
  // check all abilities and permissions using rulerRule
  const [rulerPauseAbility, rulerDeleteAbility, rulerDuplicateAbility, rulerSilenceAbility, rulerExportAbility] =
    useRulerRuleAbilities(rulerRule, groupIdentifier, [
      AlertRuleAction.Pause,
      AlertRuleAction.Delete,
      AlertRuleAction.Duplicate,
      AlertRuleAction.Silence,
      AlertRuleAction.ModifyExport,
    ]);

  // check all abilities and permissions using promRule
  const [
    grafanaPauseAbility,
    grafanaDeleteAbility,
    grafanaDuplicateAbility,
    grafanaSilenceAbility,
    grafanaExportAbility,
  ] = useGrafanaPromRuleAbilities(prometheusRuleType.grafana.rule(promRule) ? promRule : skipToken, [
    AlertRuleAction.Pause,
    AlertRuleAction.Delete,
    AlertRuleAction.Duplicate,
    AlertRuleAction.Silence,
    AlertRuleAction.ModifyExport,
  ]);

  const [editRuleSupported, editRuleAllowed] = useRulerRuleAbility(rulerRule, groupIdentifier, AlertRuleAction.Update);
  // If the consumer of this component comes from the alert list view, we need to use promRule to check abilities and permissions,
  // as we have removed all requests to the ruler API in the list view.
  const [grafanaEditRuleSupported, grafanaEditRuleAllowed] = useGrafanaPromRuleAbility(
    prometheusRuleType.grafana.rule(promRule) ? promRule : skipToken,
    AlertRuleAction.Update
  );

  const canEditRule = (editRuleSupported && editRuleAllowed) || (grafanaEditRuleSupported && grafanaEditRuleAllowed);

  const [pauseSupported, pauseAllowed] = rulerPauseAbility;
  const [grafanaPauseSupported, grafanaPauseAllowed] = grafanaPauseAbility;
  const canPause = (pauseSupported && pauseAllowed) || (grafanaPauseSupported && grafanaPauseAllowed);

  const [deleteSupported, deleteAllowed] = rulerDeleteAbility;
  const [grafanaDeleteSupported, grafanaDeleteAllowed] = grafanaDeleteAbility;
  const canDelete = (deleteSupported && deleteAllowed) || (grafanaDeleteSupported && grafanaDeleteAllowed);

  const [duplicateSupported, duplicateAllowed] = rulerDuplicateAbility;
  const [grafanaDuplicateSupported, grafanaDuplicateAllowed] = grafanaDuplicateAbility;
  const canDuplicate =
    (duplicateSupported && duplicateAllowed) || (grafanaDuplicateSupported && grafanaDuplicateAllowed);

  const [silenceSupported, silenceAllowed] = rulerSilenceAbility;
  const [grafanaSilenceSupported, grafanaSilenceAllowed] = grafanaSilenceAbility;
  const canSilence = (silenceSupported && silenceAllowed) || (grafanaSilenceSupported && grafanaSilenceAllowed);

  const [exportSupported, exportAllowed] = rulerExportAbility;
  const [grafanaExportSupported, grafanaExportAllowed] = grafanaExportAbility;
  const canExport = (exportSupported && exportAllowed) || (grafanaExportSupported && grafanaExportAllowed);

  const ruleExtensionLinks = useRulePluginLinkExtension(promRule, groupIdentifier);

  const extensionsAvailable = ruleExtensionLinks.length > 0;

  /**
   * Since Incident isn't available as an open-source product we shouldn't show it for Open-Source licenced editions of Grafana.
   * We should show it in development mode
   */
  // @TODO Migrate "declare incident button" to plugin links extensions
  const shouldShowDeclareIncidentButton =
    (!isOpenSourceEdition() || isLocalDevEnv()) &&
    prometheusRuleType.alertingRule(promRule) &&
    promRule.state === PromAlertingRuleState.Firing;

  const shareUrl = createShareLink(identifier);

  const showDivider =
    [canPause, canSilence, shouldShowDeclareIncidentButton, canDuplicate].some(Boolean) && [canExport].some(Boolean);

  // grab the UID from either rulerRule or promRule
  const ruleUid = getRuleUID(rulerRule ?? promRule);

  const isPaused =
    (rulerRuleType.grafana.rule(rulerRule) && isPausedRule(rulerRule)) ||
    (prometheusRuleType.grafana.rule(promRule) && promRule.isPaused);

  // todo: make this new menu item for enrichments an extension of the alertrulemenu items. For first iteration, we'll keep it here.
  const canManageEnrichments =
    canEditRule &&
    ruleUid &&
    handleManageEnrichments &&
    config.featureToggles.alertingEnrichmentPerRule &&
    config.featureToggles.alertEnrichment;

  const menuItems = (
    <>
      {canManageEnrichments && (
        <Menu.Item
          label={t('alerting.alert-menu.manage-enrichments', 'Manage enrichments')}
          icon="edit"
          onClick={handleManageEnrichments}
        />
      )}
      {canPause && ruleUid && groupIdentifier.groupOrigin === 'grafana' && (
        <MenuItemPauseRule
          uid={ruleUid}
          isPaused={isPaused}
          groupIdentifier={groupIdentifier}
          onPauseChange={onPauseChange}
        />
      )}
      {canSilence && (
        <Menu.Item
          label={t('alerting.alert-menu.silence-notifications', 'Silence notifications')}
          icon="bell-slash"
          onClick={handleSilence}
        />
      )}
      {/* TODO Migrate Declare Incident to plugin links extensions */}
      {shouldShowDeclareIncidentButton && <DeclareIncidentMenuItem title={promRule.name} url={''} />}
      {canDuplicate && (
        <Menu.Item
          label={t('alerting.alert-menu.duplicate', 'Duplicate')}
          icon="copy"
          onClick={() => handleDuplicateRule(identifier)}
        />
      )}
      {showDivider && <Menu.Divider />}
      {shareUrl && (
        <Menu.Item
          label={t('alerting.alert-menu.copy-link', 'Copy link')}
          icon="share-alt"
          onClick={() => copyToClipboard(shareUrl)}
        />
      )}
      {canExport && (
        <Menu.Item
          label={t('alerting.alert-menu.export', 'Export')}
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
          <Menu.Item
            label={t('alerting.common.delete', 'Delete')}
            icon="trash-alt"
            destructive
            onClick={() => {
              // if the identifier is not for a editable rule I wonder how you even got here.
              if (isEditableRuleIdentifier(identifier)) {
                handleDelete(identifier, groupIdentifier);
              }
            }}
          />
        </>
      )}
    </>
  );

  return (
    <Dropdown overlay={<Menu>{menuItems}</Menu>} placement="bottom">
      <MoreButton size={buttonSize} fill={fill} />
    </Dropdown>
  );
};

interface ExportMenuItemProps {
  identifier: RuleIdentifier;
}

const ExportMenuItem = ({ identifier }: ExportMenuItemProps) => {
  const returnTo = window.location.pathname + window.location.search;
  const url = createRelativeUrl(
    `/alerting/${encodeURIComponent(ruleId.stringifyIdentifier(identifier))}/modify-export`,
    {
      returnTo,
    }
  );

  return (
    <Menu.Item
      key="with-modifications"
      label={t('alerting.alert-menu.with-modifications', 'With modifications')}
      icon="file-edit-alt"
      url={url}
    />
  );
};

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).then(() => {
    appEvents.emit(AppEvents.alertSuccess, ['URL copied to clipboard']);
  });
}

export default AlertRuleMenu;
