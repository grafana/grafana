import { type QueryFlowLanguage } from '../model/types';

import { logqlRules } from './logqlRules';
import { promRules } from './promRules';
import { logqlSuggestionRules, promSuggestionRules } from './suggestions';
import { type DiagnosticRule } from './types';

const RULES_BY_LANGUAGE: Record<QueryFlowLanguage, DiagnosticRule[]> = {
  promql: [...promRules, ...promSuggestionRules],
  logql: [...logqlRules, ...logqlSuggestionRules],
};

export function getRulesForLanguage(language: QueryFlowLanguage): DiagnosticRule[] {
  return RULES_BY_LANGUAGE[language] ?? [];
}
