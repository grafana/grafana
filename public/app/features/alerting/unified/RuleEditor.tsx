import { cloneDeep } from 'lodash';
import React from 'react';
import { useAsync } from 'react-use';

import { NavModelItem } from '@grafana/data';
import { Alert, LoadingPlaceholder, withErrorBoundary } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch } from 'app/types';

import { RuleIdentifier, RuleWithLocation } from '../../../types/unified-alerting';
import { RulerRuleDTO } from '../../../types/unified-alerting-dto';

import { AlertWarning } from './AlertWarning';
import { ExistingRuleEditor } from './ExistingRuleEditor';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { useURLSearchParams } from './hooks/useURLSearchParams';
import { fetchAllPromBuildInfoAction, fetchEditableRuleAction } from './state/actions';
import { useRulesAccess } from './utils/accessControlHooks';
import { rulerRuleToFormValues } from './utils/rule-form';
import * as ruleId from './utils/rule-id';
import { isAlertingRulerRule, isGrafanaRulerRule, isRecordingRulerRule } from './utils/rules';

type RuleEditorProps = GrafanaRouteComponentProps<{ id?: string }>;

const defaultPageNav: Partial<NavModelItem> = {
  icon: 'bell',
  id: 'alert-rule-view',
  breadcrumbs: [{ title: 'Alert rules', url: 'alerting/list' }],
};

const getPageNav = (state: 'edit' | 'add') => {
  if (state === 'edit') {
    return { ...defaultPageNav, id: 'alert-rule-edit', text: 'Edit rule' };
  } else if (state === 'add') {
    return { ...defaultPageNav, id: 'alert-rule-add', text: 'Add rule' };
  }
  return undefined;
};

const RuleEditor = ({ match }: RuleEditorProps) => {
  const dispatch = useDispatch();
  const [searchParams] = useURLSearchParams();

  const { id } = match.params;
  const identifier = ruleId.tryParse(id, true);

  const copyFromId = searchParams.get('copyFrom') ?? undefined;
  const copyFromIdentifier = ruleId.tryParse(copyFromId);

  const { loading = true } = useAsync(async () => {
    await dispatch(fetchAllPromBuildInfoAction());
  }, [dispatch]);

  const { canCreateGrafanaRules, canCreateCloudRules, canEditRules } = useRulesAccess();

  const getContent = () => {
    if (loading) {
      return;
    }

    if (!identifier && !canCreateGrafanaRules && !canCreateCloudRules) {
      return <AlertWarning title="Cannot create rules">Sorry! You are not allowed to create rules.</AlertWarning>;
    }

    if (identifier && !canEditRules(identifier.ruleSourceName)) {
      return <AlertWarning title="Cannot edit rules">Sorry! You are not allowed to edit rules.</AlertWarning>;
    }

    if (identifier) {
      return <ExistingRuleEditor key={id} identifier={identifier} />;
    }

    if (copyFromIdentifier) {
      return <CloneRuleEditor sourceRuleId={copyFromIdentifier} />;
    }

    return <AlertRuleForm />;
  };

  return (
    <AlertingPageWrapper isLoading={loading} pageId="alert-list" pageNav={getPageNav(identifier ? 'edit' : 'add')}>
      {getContent()}
    </AlertingPageWrapper>
  );
};

export default withErrorBoundary(RuleEditor, { style: 'page' });

function CloneRuleEditor({ sourceRuleId }: { sourceRuleId: RuleIdentifier }) {
  const dispatch = useDispatch();

  const { loading, value: rule } = useAsync(
    () => dispatch(fetchEditableRuleAction(sourceRuleId)).unwrap(),
    [sourceRuleId]
  );

  if (loading) {
    return <LoadingPlaceholder text="Loading the rule" />;
  }

  if (rule) {
    const ruleClone = cloneDeep(rule);
    changeRuleName(ruleClone.rule, generateCopiedRuleTitle(ruleClone));

    return <AlertRuleForm prefill={rulerRuleToFormValues(ruleClone)} />;
  }

  return <Alert title="Cannot clone. The rule does not exist" />;
}

function generateCopiedRuleTitle(originRuleWithLocation: RuleWithLocation): string {
  const originName = getRuleName(originRuleWithLocation.rule);
  const existingRulesNames = originRuleWithLocation.group.rules.map(getRuleName);

  let newName = `${originName} (Copied)`;

  for (let i = 1; existingRulesNames.includes(newName); i++) {
    newName = `${originName} (Copied ${i})`;
  }

  return newName;
}

function getRuleName(rule: RulerRuleDTO) {
  if (isGrafanaRulerRule(rule)) {
    return rule.grafana_alert.title;
  }
  if (isAlertingRulerRule(rule)) {
    return rule.alert;
  }

  if (isRecordingRulerRule(rule)) {
    return rule.record;
  }

  return '';
}

function changeRuleName(rule: RulerRuleDTO, newName: string) {
  if (isGrafanaRulerRule(rule)) {
    rule.grafana_alert.title = newName;
  }
  if (isAlertingRulerRule(rule)) {
    rule.alert = newName;
  }

  if (isRecordingRulerRule(rule)) {
    rule.record = newName;
  }
}
