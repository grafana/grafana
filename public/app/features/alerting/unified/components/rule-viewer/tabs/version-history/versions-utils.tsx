import { IconName } from '@grafana/data';
import { t } from '@grafana/i18n';
import { BadgeColor } from '@grafana/ui';
import { RevisionModel } from 'app/core/components/VersionHistory/VersionHistoryComparison';
import {
  GrafanaAlertRuleDTOField,
  GrafanaRuleDefinition,
  RulerGrafanaRuleDTO,
  TopLevelGrafanaRuleDTOField,
} from 'app/types/unified-alerting-dto';

import { grafanaAlertPropertiesToIgnore } from '../AlertVersionHistory';

interface SpecialUidsDisplayMapEntry {
  name: string;
  tooltipContent: string;
  badgeColor: BadgeColor;
  icon?: IconName;
}

/**
 * Gets a map of special case UIDs that we should display differently.
 * Used for mapping cases where provisioning or the alerting system is listed as responsible for a version history entry.
 */

export const getSpecialUidsDisplayMap: () => Record<string, SpecialUidsDisplayMapEntry> = () => {
  const provisioning = {
    name: t('alerting.alertVersionHistory.provisioning', 'Provisioning'),
    tooltipContent: t(
      'alerting.alertVersionHistory.provisioning-change-description',
      'Version update was made via provisioning'
    ),
    badgeColor: 'purple',
  } as const;

  return {
    __alerting__: {
      name: t('alerting.alertVersionHistory.alerting', 'Alerting'),
      tooltipContent: t(
        'alerting.alertVersionHistory.alerting-change-description',
        'This update was made by the alerting system due to other changes. For example, when renaming a contact point that is used for simplified routing, this will update affected rules'
      ),
      badgeColor: 'orange',
      icon: 'bell',
    },
    service: provisioning,
    __provisioning__: provisioning,
  };
};
/**
 * Flattens a GMA rule and turns properties into human readable/translated strings, for use when computing diffs
 * and displaying in version comparisons
 */
export function preprocessRuleForDiffDisplay(rulerRule: RulerGrafanaRuleDTO<GrafanaRuleDefinition>) {
  const { grafana_alert, ...rest } = rulerRule;

  /** Translations for top level properties of alert, other than `grafana_alert` */
  const translationMap: Partial<Record<TopLevelGrafanaRuleDTOField, string>> = {
    for: t('alerting.alertVersionHistory.pendingPeriod', 'Pending period'),
    annotations: t('alerting.alertVersionHistory.annotations', 'Annotations'),
    labels: t('alerting.alertVersionHistory.labels', 'Labels'),
  };

  /** Translation map for other properties within `grafana_alert` */
  const grafanaAlertTranslationMap: Partial<Record<GrafanaAlertRuleDTOField, string>> = {
    title: t('alerting.alertVersionHistory.name', 'Name'),
    namespace_uid: t('alerting.alertVersionHistory.namespace_uid', 'Folder UID'),
    data: t('alerting.alertVersionHistory.queryAndAlertCondition', 'Query and alert condition'),
    notification_settings: t('alerting.alertVersionHistory.contactPointRouting', 'Contact point routing'),
    no_data_state: t('alerting.alertVersionHistory.noDataState', 'Alert state when no data'),
    exec_err_state: t('alerting.alertVersionHistory.execErrorState', 'Alert state when execution error'),
    is_paused: t('alerting.alertVersionHistory.paused', 'Paused state'),
    rule_group: t('alerting.alertVersionHistory.rule_group', 'Rule group'),
    condition: t('alerting.alertVersionHistory.condition', 'Alert condition'),
    intervalSeconds: t('alerting.alertVersionHistory.intervalSeconds', 'Evaluation interval'),
  };

  const processedTopLevel = Object.entries(rest).reduce((acc, [key, value]) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const topLevelRuleKey = key as keyof Omit<RulerGrafanaRuleDTO, 'grafana_alert'>;
    const potentiallyTranslatedKey = translationMap[topLevelRuleKey] || key;
    return {
      ...acc,
      [potentiallyTranslatedKey]: value,
    };
  }, {});

  const processedGrafanaAlert = Object.entries(grafana_alert).reduce((acc, [key, value]) => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const grafanaRuleKey = key as keyof GrafanaRuleDefinition;

    if (grafanaAlertPropertiesToIgnore.includes(grafanaRuleKey)) {
      return acc;
    }

    const potentiallyTranslatedKey = grafanaAlertTranslationMap[grafanaRuleKey] || key;
    return {
      ...acc,
      [potentiallyTranslatedKey]: value,
    };
  }, {});

  return {
    ...processedTopLevel,
    ...processedGrafanaAlert,
  };
}

/**
 * Turns a version of a Grafana rule definition into data structure
 * used to display the version summary when comparing versions
 */
export function parseVersionInfoToSummary(version: RulerGrafanaRuleDTO<GrafanaRuleDefinition>): RevisionModel {
  const unknown = t('alerting.alertVersionHistory.unknown', 'Unknown');
  const SPECIAL_UID_MAP = getSpecialUidsDisplayMap();
  const createdBy = (() => {
    const updatedBy = version?.grafana_alert.updated_by;
    const uid = updatedBy?.uid;
    const name = updatedBy?.name;

    if (!updatedBy) {
      return unknown;
    }
    if (uid && SPECIAL_UID_MAP[uid]) {
      return SPECIAL_UID_MAP[uid].name;
    }
    if (name) {
      return name;
    }
    return uid ? t('alerting.alertVersionHistory.user-id', 'User ID {{uid}}', { uid }) : unknown;
  })();

  return {
    createdAt: version.grafana_alert.updated || unknown,
    createdBy,
    version: version.grafana_alert.version || unknown,
  };
}
