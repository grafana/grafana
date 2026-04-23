import { type Rule, type RuleGroup } from 'app/types/unified-alerting';
import { PromRuleType } from 'app/types/unified-alerting-dto';

import { RuleSource, type RulesFilter } from '../../../search/rulesSearchParser';
import { getRuleHealth, prometheusRuleType } from '../../../utils/rules';

import { type TreeDataSource, type TreeFolder, type TreeModel } from './types';

export interface ApplyFilterOptions {
  ignoreRuleState?: boolean;
}

export function applyRulesFilterToTree(
  model: TreeModel,
  filter: RulesFilter,
  options: ApplyFilterOptions = {}
): TreeModel {
  const effective = options.ignoreRuleState ? { ...filter, ruleState: undefined } : filter;

  const dataSources = model.dataSources.map((ds) => filterDataSource(ds, effective)).filter(hasContent);

  return { dataSources };
}

function filterDataSource(ds: TreeDataSource, filter: RulesFilter): TreeDataSource {
  if (ds.error) {
    return ds;
  }

  if (filter.ruleSource === RuleSource.Grafana && !ds.isGrafana) {
    return { ...ds, folders: [] };
  }
  if (filter.ruleSource === RuleSource.DataSource && ds.isGrafana) {
    return { ...ds, folders: [] };
  }

  if (filter.dataSourceNames?.length) {
    if (!ds.isGrafana && !filter.dataSourceNames.includes(ds.name)) {
      return { ...ds, folders: [] };
    }
  }

  const folders = ds.folders.map((f) => filterFolder(f, filter)).filter((f): f is TreeFolder => f !== null);
  return { ...ds, folders };
}

function filterFolder(folder: TreeFolder, filter: RulesFilter): TreeFolder | null {
  if (filter.namespace && !folder.title.toLowerCase().includes(filter.namespace.toLowerCase())) {
    return null;
  }

  const groups = folder.groups.map((g) => filterGroup(g, filter)).filter((g): g is RuleGroup => g !== null);
  if (groups.length === 0) {
    return null;
  }
  return { ...folder, groups };
}

function filterGroup(group: RuleGroup, filter: RulesFilter): RuleGroup | null {
  if (filter.groupName && !group.name.toLowerCase().includes(filter.groupName.toLowerCase())) {
    return null;
  }
  const rules = group.rules.filter((r) => matchesRule(r, filter));
  if (rules.length === 0) {
    return null;
  }
  return { ...group, rules };
}

function matchesRule(rule: Rule, filter: RulesFilter): boolean {
  if (filter.ruleName && !rule.name.toLowerCase().includes(filter.ruleName.toLowerCase())) {
    return false;
  }

  if (filter.ruleType && rule.type !== filter.ruleType) {
    return false;
  }

  if (filter.ruleState) {
    if (!prometheusRuleType.alertingRule(rule)) {
      return false;
    }
    if (rule.state !== filter.ruleState) {
      return false;
    }
  }

  if (filter.ruleHealth) {
    const health = getRuleHealth(rule.health);
    if (health !== filter.ruleHealth) {
      return false;
    }
  }

  if (filter.labels?.length) {
    const ruleLabels = rule.labels ?? {};
    for (const matcher of filter.labels) {
      if (!matchesLabel(ruleLabels, matcher)) {
        return false;
      }
    }
  }

  // Free-form words: match alert name or label values loosely.
  if (filter.freeFormWords?.length) {
    const haystack = ruleSearchableText(rule);
    for (const word of filter.freeFormWords) {
      if (!haystack.includes(word.toLowerCase())) {
        return false;
      }
    }
  }

  return true;
}

function matchesLabel(labels: Record<string, string>, matcher: string): boolean {
  const eq = matcher.split('=');
  if (eq.length !== 2) {
    return true;
  }
  const [key, rawValue] = eq;
  const value = rawValue.replace(/^"|"$/g, '');
  return labels[key] === value;
}

function ruleSearchableText(rule: Rule): string {
  const parts: string[] = [rule.name];
  if (rule.labels) {
    for (const [k, v] of Object.entries(rule.labels)) {
      parts.push(k, v);
    }
  }
  if (rule.type === PromRuleType.Alerting && rule.annotations) {
    for (const v of Object.values(rule.annotations)) {
      parts.push(v);
    }
  }
  return parts.join(' ').toLowerCase();
}

function hasContent(ds: TreeDataSource): boolean {
  return ds.folders.length > 0 || Boolean(ds.error);
}
