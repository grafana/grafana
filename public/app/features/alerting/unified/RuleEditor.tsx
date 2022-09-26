import React, { FC } from 'react';
import { useAsync } from 'react-use';

import { LoadingPlaceholder, withErrorBoundary } from '@grafana/ui';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { useDispatch } from 'app/types';

import { AlertWarning } from './AlertWarning';
import { ExistingRuleEditor } from './ExistingRuleEditor';
import { RuleEditorWrapper } from './RuleEditorWrapper';
import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { fetchAllPromBuildInfoAction } from './state/actions';
import { useRulesAccess } from './utils/accessControlHooks';
import * as ruleId from './utils/rule-id';

type RuleEditorProps = GrafanaRouteComponentProps<{ id?: string }>;

const RuleEditor: FC<RuleEditorProps> = ({ match }) => {
  const dispatch = useDispatch();
  const { id } = match.params;
  const identifier = ruleId.tryParse(id, true);

  const { loading } = useAsync(async () => {
    await dispatch(fetchAllPromBuildInfoAction());
  }, [dispatch]);

  const { canCreateGrafanaRules, canCreateCloudRules, canEditRules } = useRulesAccess();

  const getContent = () => {
    if (!identifier && !canCreateGrafanaRules && !canCreateCloudRules) {
      return <AlertWarning title="Cannot create rules">Sorry! You are not allowed to create rules.</AlertWarning>;
    }

    if (identifier && !canEditRules(identifier.ruleSourceName)) {
      return <AlertWarning title="Cannot edit rules">Sorry! You are not allowed to edit rules.</AlertWarning>;
    }

    if (loading) {
      return <LoadingPlaceholder text="Loading..." />;
    }

    if (identifier) {
      return <ExistingRuleEditor key={id} identifier={identifier} />;
    }

    return <AlertRuleForm />;
  };

  return <RuleEditorWrapper edit={Boolean(identifier)}>{getContent()}</RuleEditorWrapper>;
};

export default withErrorBoundary(RuleEditor, { style: 'page' });
