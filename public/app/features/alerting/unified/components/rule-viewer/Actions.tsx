import React from 'react';

import { AppEvents, PluginExtensionPoints } from '@grafana/data';
import { getPluginLinkExtensions } from '@grafana/runtime';
import { Dropdown, LinkButton, Menu } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import MenuItemPauseRule from 'app/features/alerting/unified/components/MenuItemPauseRule';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { createShareLink, isLocalDevEnv, isOpenSourceEdition, makeRuleBasedSilenceLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { getRuleOrigin } from '../../utils/rules';
import { createUrl } from '../../utils/url';
import MoreButton from '../MoreButton';
import { DeclareIncidentMenuItem } from '../bridges/DeclareIncidentButton';

import { useAlertRule } from './RuleContext';

interface Props {
  handleDelete: (rule: CombinedRule) => void;
  handleDuplicateRule: (identifier: RuleIdentifier) => void;
}

export const useAlertRulePageActions = ({ handleDelete, handleDuplicateRule }: Props) => {
  const { rule, identifier } = useAlertRule();
  const rulePluginLinkExtension = useRulePluginLinkExtension(rule);

  // check all abilities and permissions
  const [editSupported, editAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Update);
  const canEdit = editSupported && editAllowed;

  const [deleteSupported, deleteAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Delete);
  const canDelete = deleteSupported && deleteAllowed;

  const [duplicateSupported, duplicateAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Duplicate);
  const canDuplicate = duplicateSupported && duplicateAllowed;

  const [silenceSupported, silenceAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Silence);
  const canSilence = silenceSupported && silenceAllowed;

  const [exportSupported, exportAllowed] = useAlertRuleAbility(rule, AlertRuleAction.ModifyExport);
  const canExport = exportSupported && exportAllowed;

  /**
   * Since Incident isn't available as an open-source product we shouldn't show it for Open-Source licenced editions of Grafana.
   * We should show it in development mode
   */
  const shouldShowDeclareIncidentButton = !isOpenSourceEdition() || isLocalDevEnv();
  const shareUrl = createShareLink(rule.namespace.rulesSource, rule);

  return [
    canEdit && <EditButton key="edit-action" identifier={identifier} />,
    <Dropdown
      key="more-actions"
      overlay={
        <Menu>
          {canEdit && <MenuItemPauseRule rule={rule} />}
          {canSilence && (
            <Menu.Item
              label="Silence notifications"
              icon="bell-slash"
              url={makeRuleBasedSilenceLink(identifier.ruleSourceName, rule)}
            />
          )}
          {shouldShowDeclareIncidentButton && <DeclareIncidentMenuItem title={rule.name} url={''} />}
          {canDuplicate && <Menu.Item label="Duplicate" icon="copy" onClick={() => handleDuplicateRule(identifier)} />}
          <Menu.Divider />
          <Menu.Item label="Copy link" icon="share-alt" onClick={() => copyToClipboard(shareUrl)} />
          {canExport && (
            <Menu.Item
              label="Export"
              icon="download-alt"
              childItems={[<ExportMenuItem key="export-with-modifications" identifier={identifier} />]}
            />
          )}
          {rulePluginLinkExtension.length > 0 && (
            <>
              <Menu.Divider />
              {rulePluginLinkExtension.map((extension) => (
                <Menu.Item
                  key={extension.id}
                  label={extension.title}
                  icon={extension.icon}
                  onClick={extension.onClick}
                />
              ))}
            </>
          )}
          {canDelete && (
            <>
              <Menu.Divider />
              <Menu.Item label="Delete" icon="trash-alt" destructive onClick={() => handleDelete(rule)} />
            </>
          )}
        </Menu>
      }
    >
      <MoreButton size="md" />
    </Dropdown>,
  ];
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

const EditButton = ({ identifier }: PropsWithIdentifier) => {
  const returnTo = location.pathname + location.search;
  const ruleIdentifier = ruleId.stringifyIdentifier(identifier);
  const editURL = createUrl(`/alerting/${encodeURIComponent(ruleIdentifier)}/edit`, { returnTo });

  return (
    <LinkButton variant="secondary" icon="pen" href={editURL}>
      Edit
    </LinkButton>
  );
};

function useRulePluginLinkExtension(rule: CombinedRule) {
  const ruleOrigin = getRuleOrigin(rule);
  const ruleType = rule.promRule?.type;
  if (!ruleOrigin || !ruleType) {
    return [];
  }

  const { pluginId } = ruleOrigin;

  switch (ruleType) {
    case PromRuleType.Alerting:
      return getAlertingRuleActionPluginLinkExtension({ pluginId, rule });
    case PromRuleType.Recording:
      return getRecordingRulePluginLinkExtension({ pluginId, rule });
    default:
      return [];
  }
}

function getAlertingRuleActionPluginLinkExtension({ pluginId, rule }: { pluginId: string; rule: CombinedRule }) {
  const context: AlertingRuleExtensionContext = {
    name: rule.name,
    namespace: rule.namespace.name,
    group: rule.group.name,
    expression: rule.query,
    labels: rule.labels,
    annotations: rule.annotations,
  };

  const { extensions } = getPluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.AlertingRuleAction,
    context,
    limitPerPlugin: 3,
  });

  return extensions.filter((extension) => extension.pluginId === pluginId);
}

function getRecordingRulePluginLinkExtension({ pluginId, rule }: { pluginId: string; rule: CombinedRule }) {
  const context: RecordingRuleExtensionContext = {
    name: rule.name,
    namespace: rule.namespace.name,
    group: rule.group.name,
    expression: rule.query,
    labels: rule.labels,
  };

  const { extensions } = getPluginLinkExtensions({
    extensionPointId: PluginExtensionPoints.RecordingRuleAction,
    context,
    limitPerPlugin: 3,
  });

  return extensions.filter((extension) => extension.pluginId === pluginId);
}

interface AlertingRuleExtensionContext {
  name: string;
  namespace: string;
  group: string;
  expression: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

interface RecordingRuleExtensionContext {
  name: string;
  namespace: string;
  group: string;
  expression: string;
  labels: Record<string, string>;
}
