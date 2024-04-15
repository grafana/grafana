import React, { Fragment } from 'react';

import { AppEvents } from '@grafana/data';
import { ComponentSize, Menu } from '@grafana/ui';
import appEvents from 'app/core/app_events';
import MenuItemPauseRule from 'app/features/alerting/unified/components/MenuItemPauseRule';
import { CombinedRule, RuleIdentifier } from 'app/types/unified-alerting';

import { AlertRuleAction, useAlertRuleAbility } from '../../hooks/useAbilities';
import { createShareLink, isLocalDevEnv, isOpenSourceEdition, makeRuleBasedSilenceLink } from '../../utils/misc';
import * as ruleId from '../../utils/rule-id';
import { createUrl } from '../../utils/url';
import { DeclareIncidentMenuItem } from '../bridges/DeclareIncidentButton';

interface Props {
  rule: CombinedRule;
  identifier?: RuleIdentifier;
  showCopyLinkButton?: boolean;
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
export const useAlertRuleMenuItems = ({
  rule,
  identifier,
  showCopyLinkButton,
  handleDelete,
  handleDuplicateRule,
  onPauseChange,
}: Props) => {
  // check all abilities and permissions
  const [editSupported, editAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Update);
  const canEdit = editSupported && editAllowed;

  const [deleteSupported, deleteAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Delete);
  const canDelete = deleteSupported && deleteAllowed;

  const [duplicateSupported, duplicateAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Duplicate);
  const canDuplicate = duplicateSupported && duplicateAllowed && identifier;

  const [silenceSupported, silenceAllowed] = useAlertRuleAbility(rule, AlertRuleAction.Silence);
  const canSilence = silenceSupported && silenceAllowed && identifier;

  const [exportSupported, exportAllowed] = useAlertRuleAbility(rule, AlertRuleAction.ModifyExport);
  const canExport = exportSupported && exportAllowed && identifier;

  /**
   * Since Incident isn't available as an open-source product we shouldn't show it for Open-Source licenced editions of Grafana.
   * We should show it in development mode
   */
  const shouldShowDeclareIncidentButton = !isOpenSourceEdition() || isLocalDevEnv();
  const shareUrl = createShareLink(rule.namespace.rulesSource, rule);

  const showDivider =
    [canEdit, canSilence, shouldShowDeclareIncidentButton, canDuplicate].some(Boolean) &&
    [showCopyLinkButton, canExport, canDelete].some(Boolean);

  return [
    canEdit && <MenuItemPauseRule key="pause" rule={rule} onPauseChange={onPauseChange} />,
    canSilence && (
      <Menu.Item
        key="silence"
        label="Silence notifications"
        icon="bell-slash"
        url={makeRuleBasedSilenceLink(identifier.ruleSourceName, rule)}
      />
    ),
    shouldShowDeclareIncidentButton && <DeclareIncidentMenuItem key="declare-incident" title={rule.name} url={''} />,
    canDuplicate && (
      <Menu.Item key="duplicate" label="Duplicate" icon="copy" onClick={() => handleDuplicateRule(identifier)} />
    ),
    showDivider && <Menu.Divider key="divider" />,
    showCopyLinkButton && (
      <Menu.Item key="copy" label="Copy link" icon="share-alt" onClick={() => copyToClipboard(shareUrl)} />
    ),
    canExport && (
      <Menu.Item
        key="export"
        label="Export"
        icon="download-alt"
        childItems={[<ExportMenuItem key="export-with-modifications" identifier={identifier} />]}
      />
    ),
    canDelete && (
      <Fragment key="delete">
        <Menu.Divider />
        <Menu.Item label="Delete" icon="trash-alt" destructive onClick={() => handleDelete(rule)} />
      </Fragment>
    ),
  ].filter(Boolean);
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
