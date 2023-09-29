import * as React from 'react';
import { useEffect, useState } from 'react';
import { useAsync } from 'react-use';

import { locationService } from '@grafana/runtime';
import { Alert, LoadingPlaceholder } from '@grafana/ui';

import { GrafanaRouteComponentProps } from '../../../../../core/navigation/types';
import { useDispatch } from '../../../../../types';
import { RuleIdentifier } from '../../../../../types/unified-alerting';
import { fetchEditableRuleAction, fetchRulesSourceBuildInfoAction } from '../../state/actions';
import { formValuesFromExistingRule } from '../../utils/rule-form';
import * as ruleId from '../../utils/rule-id';
import { isGrafanaRulerRule } from '../../utils/rules';
import { createUrl } from '../../utils/url';
import { AlertingPageWrapper } from '../AlertingPageWrapper';
import { ModifyExportRuleForm } from '../rule-editor/alert-rule-form/ModifyExportRuleForm';

interface GrafanaModifyExportProps extends GrafanaRouteComponentProps<{ id?: string }> {}

export default function GrafanaModifyExport({ match }: GrafanaModifyExportProps) {
  const dispatch = useDispatch();

  // Get rule source build info
  const [ruleIdentifier, setRuleIdentifier] = useState<RuleIdentifier | undefined>(undefined);

  useEffect(() => {
    const identifier = ruleId.tryParse(match.params.id, true);
    setRuleIdentifier(identifier);
  }, [match.params.id]);

  const { loading: loadingBuildInfo = true } = useAsync(async () => {
    if (ruleIdentifier) {
      await dispatch(fetchRulesSourceBuildInfoAction({ rulesSourceName: ruleIdentifier.ruleSourceName }));
    }
  }, [dispatch, ruleIdentifier]);

  // Get rule
  const {
    loading,
    value: alertRule,
    error,
  } = useAsync(async () => {
    if (!ruleIdentifier) {
      return;
    }
    return await dispatch(fetchEditableRuleAction(ruleIdentifier)).unwrap();
  }, [ruleIdentifier, loadingBuildInfo]);

  if (!ruleIdentifier) {
    return <div>Rule not found</div>;
  }

  if (loading) {
    return <LoadingPlaceholder text="Loading the rule" />;
  }

  if (error) {
    return (
      <Alert title="Cannot load modify export" severity="error">
        {error.message}
      </Alert>
    );
  }

  if (!alertRule && !loading && !loadingBuildInfo) {
    // alert rule does not exist
    return (
      <AlertingPageWrapper isLoading={loading} pageId="alert-list" pageNav={{ text: 'Modify export' }}>
        <Alert
          title="Cannot load the rule. The rule does not exist"
          buttonContent="Go back to alert list"
          onRemove={() => locationService.replace(createUrl('/alerting/list'))}
        />
      </AlertingPageWrapper>
    );
  }

  if (alertRule && !isGrafanaRulerRule(alertRule.rule)) {
    // alert rule exists but is not a grafana-managed rule
    return (
      <AlertingPageWrapper isLoading={loading} pageId="alert-list" pageNav={{ text: 'Modify export' }}>
        <Alert
          title="This rule is not a Grafana-managed alert rule"
          buttonContent="Go back to alert list"
          onRemove={() => locationService.replace(createUrl('/alerting/list'))}
        />
      </AlertingPageWrapper>
    );
  }

  return (
    <AlertingPageWrapper isLoading={loading} pageId="alert-list" pageNav={{ text: 'Modify export' }}>
      {alertRule && <ModifyExportRuleForm ruleForm={formValuesFromExistingRule(alertRule)} />}
    </AlertingPageWrapper>
  );
}
