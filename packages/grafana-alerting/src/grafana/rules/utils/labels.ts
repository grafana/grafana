import { type Label } from '../../matchers/types';

const GRAFANA_ORIGIN_LABEL = '__grafana_origin';

/** The rule's title. Grafana adds it to every alert from a Grafana-managed rule. */
export const ALERTNAME_LABEL = 'alertname';
/** The title of the rule's folder. Grafana adds it to every alert unless the instance turns it off. */
export const GRAFANA_FOLDER_LABEL = 'grafana_folder';
/** The rule's UID. Grafana adds it to every alert from a Grafana-managed rule. */
export const ALERT_RULE_UID_LABEL = '__alert_rule_uid__';
/** The UID of the rule's folder. Grafana adds it to every alert from a Grafana-managed rule. */
export const ALERT_RULE_NAMESPACE_UID_LABEL = '__alert_rule_namespace_uid__';

export interface GrafanaRuleInstanceLabelsOptions {
  /** The rule's title, which becomes `alertname`. */
  title: string;
  /** The title of the rule's folder, which becomes `grafana_folder`. Leave it out when the folder isn't known. */
  folderTitle?: string;
  uid?: string;
  folderUid?: string;
  /** The labels set on the rule itself. */
  labels?: Record<string, string>;
}

/**
 * The labels an alert from a Grafana-managed rule is known to have before the rule runs: the rule's own
 * labels plus the ones Grafana adds. Useful as `instancesToPreview`, to show which notification policy
 * an alert would be routed to.
 *
 * When a rule label has the same name as one Grafana adds, Grafana's value is used, as the backend does.
 * Labels that come from the query result (e.g. `instance` or `job`) can't be known up front, so routes
 * that match on them won't show up in a preview.
 */
export function getGrafanaRuleInstanceLabels({
  title,
  folderTitle,
  uid,
  folderUid,
  labels = {},
}: GrafanaRuleInstanceLabelsOptions): Label[] {
  const grafanaLabels: Record<string, string> = { [ALERTNAME_LABEL]: title };
  if (folderTitle) {
    grafanaLabels[GRAFANA_FOLDER_LABEL] = folderTitle;
  }
  if (uid) {
    grafanaLabels[ALERT_RULE_UID_LABEL] = uid;
  }
  if (folderUid) {
    grafanaLabels[ALERT_RULE_NAMESPACE_UID_LABEL] = folderUid;
  }

  return Object.entries({ ...labels, ...grafanaLabels });
}

function isPrivateLabelKey(labelKey: string) {
  return (labelKey.startsWith('__') && labelKey.endsWith('__')) || labelKey === GRAFANA_ORIGIN_LABEL;
}

export const isPrivateLabel = ([key, _]: [string, string]) => isPrivateLabelKey(key);

/**
 * Returns a map labels that are common to the given label sets.
 */
export function findCommonLabels(labelSets: Array<Record<string, string>>): Record<string, string> {
  if (!Array.isArray(labelSets) || labelSets.length === 0) {
    return {};
  }
  return labelSets.reduce(
    (acc, labels) => {
      if (!labels) {
        throw new Error('Need parsed labels to find common labels.');
      }
      // Remove incoming labels that are missing or not matching in value
      Object.keys(labels).forEach((key) => {
        if (acc[key] === undefined || acc[key] !== labels[key]) {
          delete acc[key];
        }
      });
      // Remove common labels that are missing from incoming label set
      Object.keys(acc).forEach((key) => {
        if (labels[key] === undefined) {
          delete acc[key];
        }
      });
      return acc;
    },
    { ...labelSets[0] }
  );
}
