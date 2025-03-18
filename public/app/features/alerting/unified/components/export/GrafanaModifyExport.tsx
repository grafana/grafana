import * as React from 'react';
import { useMemo } from 'react';
import { useParams } from 'react-router-dom-v5-compat';

import { locationService } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

import { RuleIdentifier } from '../../../../../types/unified-alerting';
import { useRuleWithLocation } from '../../hooks/useCombinedRule';
import { stringifyErrorLike } from '../../utils/misc';
import { formValuesFromExistingRule } from '../../utils/rule-form';
import * as ruleId from '../../utils/rule-id';
import { isGrafanaRulerRule } from '../../utils/rules';
import { createRelativeUrl } from '../../utils/url';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { ModifyExportRuleForm } from '../rule-editor/alert-rule-form/ModifyExportRuleForm';

export default function GrafanaModifyExport() {
  const { id } = useParams();
  const ruleIdentifier = useMemo<RuleIdentifier | undefined>(() => {
    return ruleId.tryParse(id, true);
  }, [id]);

  if (!ruleIdentifier) {
    return (
      <ModifyExportWrapper>
        <Alert title="Invalid rule ID" severity="error">
          The rule UID in the page URL is invalid. Please check the URL and try again.
        </Alert>
      </ModifyExportWrapper>
    );
  }

  return (
    <ModifyExportWrapper>
      <RuleModifyExport ruleIdentifier={ruleIdentifier} />
    </ModifyExportWrapper>
  );
}

interface ModifyExportWrapperProps {
  children: React.ReactNode;
}

function ModifyExportWrapper({ children }: ModifyExportWrapperProps) {
  return (
    <AlertingPageWrapper
      navId="alert-list"
      pageNav={{
        text: 'Modify export',
        subTitle:
          'Modify the current alert rule and export the rule definition in the format of your choice. Any changes you make will not be saved.',
      }}
    >
      {children}
    </AlertingPageWrapper>
  );
}

function RuleModifyExport({ ruleIdentifier }: { ruleIdentifier: RuleIdentifier }) {
  const { loading, error, result: rulerRule } = useRuleWithLocation({ ruleIdentifier: ruleIdentifier });

  if (loading) {
    return <LoadingPlaceholder text="Loading the rule..." />;
  }

  if (error) {
    return (
      <Alert title="Cannot load modify export" severity="error">
        {stringifyErrorLike(error)}
      </Alert>
    );
  }

  if (!rulerRule && !loading) {
    // alert rule does not exist
    return (
      <Alert
        title="Cannot load the rule. The rule does not exist"
        buttonContent="Go back to alert list"
        onRemove={() => locationService.replace(createRelativeUrl('/alerting/list'))}
      />
    );
  }

  if (rulerRule && !isGrafanaRulerRule(rulerRule.rule)) {
    // alert rule exists but is not a grafana-managed rule
    return (
      <Alert
        title="This rule is not a Grafana-managed alert rule"
        buttonContent="Go back to alert list"
        onRemove={() => locationService.replace(createRelativeUrl('/alerting/list'))}
      />
    );
  }

  if (rulerRule && isGrafanaRulerRule(rulerRule.rule)) {
    return (
      <ModifyExportRuleForm
        ruleForm={formValuesFromExistingRule(rulerRule)}
        alertUid={rulerRule.rule.grafana_alert.uid}
      />
    );
  }

  return <Alert title="Unknown error" />;
}
