import coreModule from 'app/core/core_module';
import numericRules from './numeric_rules';
import textRules from './text_rules';
import objectRules from './object_rules';

export enum RuleKind {
  Object = 'OBJECT',
  Text = 'TEXT',
  Numeric = 'NUMERIC',
  Date = 'DATE',
}

export interface RuleDefinition {
  name: string;
  description: string;
  kind: RuleKind;
  evaluate: (input: any, params: any[]) => boolean;
}

export interface RuleType {
  value: string;
  text: string;
}

export default class RuleEvaluator {
  private rules: Map<string, RuleDefinition> = new Map<string, RuleDefinition>();

  constructor(private timezone: string) {
    objectRules().forEach(rule => {
      this.rules.set(rule.name, rule);
    });
    textRules().forEach(rule => {
      this.rules.set(rule.name, rule);
    });
    numericRules().forEach(rule => {
      this.rules.set(rule.name, rule);
    });
  }

  evaluateRule(rule: string, input: any, params?: any[]): boolean {
    if (!this.rules.has(rule)) {
      return false;
    }

    const r = this.rules.get(rule);

    if (r.kind === RuleKind.Date) {
      params.push(this.timezone);
    }

    return r.evaluate(input, params);
  }

  getRuleTypes(): RuleType[] {
    return Array.from(this.rules.keys()).map(name => {
      const r = this.rules.get(name);
      return {
        value: name,
        text: r.description,
        kind: r.kind,
      };
    });
  }
}

coreModule.service('ruleEvaluator', RuleEvaluator);
