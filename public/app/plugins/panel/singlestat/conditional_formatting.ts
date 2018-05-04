import RuleEvaluator, { RuleType } from 'app/core/services/rule_evaluation/rule_evaluator';

export class ConditionalFormattingCtrl {
  panel: any;
  panelCtrl: any;
  unitFormats: any;
  logScales: any;
  xAxisModes: any;
  xAxisStatOptions: any;
  xNameSegment: any;
  ruleEvaluator: RuleEvaluator;
  ruleTypes: RuleType[];

  /** @ngInject */
  constructor(private $scope) {
    this.panelCtrl = $scope.ctrl;
    this.panel = this.panelCtrl.panel;
    this.$scope.ctrl = this;
    this.ruleEvaluator = this.panelCtrl.ruleEvaluator;

    this.ruleTypes = this.ruleEvaluator.getRuleTypes();
  }

  render() {
    this.panelCtrl.render();
  }

  addRule() {
    this.panel.formattingRules.push({
      rule: 'is_not_empty',
    });
    this.render();
  }
}

/** @ngInject */
export function conditionalFormattingEditorComponent() {
  'use strict';
  return {
    restrict: 'E',
    scope: true,
    templateUrl: 'public/app/plugins/panel/singlestat/conditional_formatting.html',
    controller: ConditionalFormattingCtrl,
  };
}
