import { produce } from 'immer';
import { useCallback, useState } from 'react';

import { useAssistant, useInlineAssistant } from '@grafana/assistant';
import { type RuleGroupIdentifier } from 'app/types/unified-alerting';
import { type RulerGrafanaRuleDTO } from 'app/types/unified-alerting-dto';

import { alertRuleApi } from '../api/alertRuleApi';
import { GRAFANA_RULES_SOURCE_NAME } from '../utils/datasource';
import { fromRulerRule } from '../utils/rule-id';

import { Annotation } from '../utils/constants';

import { useUpdateRuleInRuleGroup } from './ruleGroup/useUpsertRuleFromRuleGroup';
import { type IncompleteRule } from './useIncompleteRules';

// Placeholder runbook URL filled in when a rule is missing one, so the demo
// shows a complete rule after "Fix with AI".
const PLACEHOLDER_RUNBOOK_URL = 'https://sre.google';

export interface FixProgress {
  total: number;
  completed: number;
  currentRuleName?: string;
  errors: Array<{ name: string; error: string }>;
}

const SYSTEM_PROMPT =
  'You are an expert SRE writing alert rule annotations. ' +
  'Write a concise summary and an actionable description for the given Grafana alert rule. ' +
  'Preserve metric names, thresholds, and technical accuracy. Do not invent values that are not present. ' +
  'Output exactly two lines in the format:\nSUMMARY: <text>\nDESCRIPTION: <text>\nNo other output.';

/**
 * Builds a textual context describing the rule for the assistant, including its
 * query definitions and any existing annotations/labels so generated text stays
 * grounded in the actual rule.
 */
function buildRuleContext(rule: RulerGrafanaRuleDTO): string {
  const { grafana_alert: grafanaAlert, annotations = {}, labels = {} } = rule;

  const queries = (grafanaAlert.data ?? [])
    .map((query) => {
      const model = query.model ? JSON.stringify(query.model) : '';
      return `  - refId ${query.refId} (datasource ${query.datasourceUid}): ${model}`;
    })
    .join('\n');

  const labelsStr = Object.entries(labels)
    .map(([k, v]) => `${k}="${v}"`)
    .join(', ');

  const existingAnnotations = Object.entries(annotations)
    .map(([k, v]) => `  - ${k}: ${v}`)
    .join('\n');

  return (
    `Rule name: ${grafanaAlert.title}\n` +
    `Condition refId: ${grafanaAlert.condition}\n` +
    (queries ? `Queries:\n${queries}\n` : '') +
    (labelsStr ? `Labels: ${labelsStr}\n` : '') +
    (existingAnnotations ? `Existing annotations:\n${existingAnnotations}\n` : '')
  );
}

function parseGeneratedAnnotations(text: string): { summary?: string; description?: string } {
  const summaryMatch = text.match(/SUMMARY:\s*(.+)/i);
  const descMatch = text.match(/DESCRIPTION:\s*(.+)/i);
  return {
    summary: summaryMatch?.[1].trim(),
    description: descMatch?.[1].trim(),
  };
}

/**
 * Reviews incomplete alert rules with the Grafana Assistant and updates each
 * rule's summary and description annotations in place.
 *
 * Rules are processed sequentially because a single inline assistant hook
 * instance runs one generation at a time.
 */
export function useFixIncompleteRules() {
  const { isAvailable } = useAssistant();
  const { generate } = useInlineAssistant();
  const [updateRuleInRuleGroup] = useUpdateRuleInRuleGroup();
  const [fetchRule] = alertRuleApi.endpoints.getAlertRule.useLazyQuery();

  const [progress, setProgress] = useState<FixProgress | null>(null);
  const [isFixing, setIsFixing] = useState(false);

  const fixRule = useCallback(
    async (rule: IncompleteRule) => {
      if (!rule.uid) {
        throw new Error('Rule has no UID and cannot be updated');
      }

      const rulerRule = await fetchRule({ uid: rule.uid }).unwrap();

      const generated = await new Promise<{ summary?: string; description?: string }>((resolve, reject) => {
        generate({
          prompt:
            buildRuleContext(rulerRule) +
            '\n\nWrite the two fields:\n' +
            'SUMMARY: A clear 1-2 sentence summary of what the alert monitors and when it fires.\n' +
            'DESCRIPTION: A concise explanation with the context an on-call engineer needs — what to check and likely next steps.',
          origin: 'alerting/quality/fix-with-ai',
          agentName: 'alert-annotation-generator',
          systemPrompt: SYSTEM_PROMPT,
          onComplete: (text) => resolve(parseGeneratedAnnotations(text)),
          onError: (error) => reject(error),
        });
      });

      if (!generated.summary && !generated.description) {
        throw new Error('Assistant did not return a summary or description');
      }

      const updatedRule = produce(rulerRule, (draft) => {
        draft.annotations = {
          ...draft.annotations,
          ...(generated.summary ? { summary: generated.summary } : {}),
          ...(generated.description ? { description: generated.description } : {}),
          ...(draft.annotations?.[Annotation.runbookURL]
            ? {}
            : { [Annotation.runbookURL]: PLACEHOLDER_RUNBOOK_URL }),
        };
      });

      const ruleGroup: RuleGroupIdentifier = {
        dataSourceName: GRAFANA_RULES_SOURCE_NAME,
        namespaceName: rulerRule.grafana_alert.namespace_uid,
        groupName: rulerRule.grafana_alert.rule_group,
      };
      const identifier = fromRulerRule(
        GRAFANA_RULES_SOURCE_NAME,
        ruleGroup.namespaceName,
        ruleGroup.groupName,
        rulerRule
      );

      await updateRuleInRuleGroup.execute(ruleGroup, identifier, updatedRule);
    },
    [fetchRule, generate, updateRuleInRuleGroup]
  );

  const fixAll = useCallback(
    async (rules: IncompleteRule[]) => {
      const fixable = rules.filter((rule) => rule.uid);
      setIsFixing(true);
      setProgress({ total: fixable.length, completed: 0, errors: [] });

      for (const rule of fixable) {
        setProgress((prev) => (prev ? { ...prev, currentRuleName: rule.name } : prev));
        try {
          await fixRule(rule);
        } catch (error) {
          setProgress((prev) =>
            prev ? { ...prev, errors: [...prev.errors, { name: rule.name, error: errorMessage(error) }] } : prev
          );
        } finally {
          setProgress((prev) => (prev ? { ...prev, completed: prev.completed + 1 } : prev));
        }
      }

      setProgress((prev) => (prev ? { ...prev, currentRuleName: undefined } : prev));
      setIsFixing(false);
    },
    [fixRule]
  );

  return { isAvailable, isFixing, progress, fixRule, fixAll };
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}
