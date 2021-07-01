import { css } from '@emotion/css';
import { GrafanaTheme2 } from '@grafana/data';
import { Alert, LinkButton, LoadingPlaceholder, useStyles2, withErrorBoundary } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { contextSrv } from 'app/core/services/context_srv';
import { useCleanup } from 'app/core/hooks/useCleanup';
import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import { RuleIdentifier } from 'app/types/unified-alerting';
import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { useIsRuleEditable } from './hooks/useIsRuleEditable';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchEditableRuleAction } from './state/actions';
import * as ruleId from './utils/rule-id';

interface ExistingRuleEditorProps {
  identifier: RuleIdentifier;
}

const ExistingRuleEditor: FC<ExistingRuleEditorProps> = ({ identifier }) => {
  useCleanup((state) => state.unifiedAlerting.ruleForm.existingRule);
  const { loading, result, error, dispatched } = useUnifiedAlertingSelector((state) => state.ruleForm.existingRule);
  const dispatch = useDispatch();
  const { isEditable } = useIsRuleEditable(result?.rule);

  useEffect(() => {
    if (!dispatched) {
      dispatch(fetchEditableRuleAction(identifier));
    }
  }, [dispatched, dispatch, identifier]);

  if (loading || isEditable === undefined) {
    return (
      <Page.Contents>
        <LoadingPlaceholder text="Loading rule..." />
      </Page.Contents>
    );
  }
  if (error) {
    return (
      <Page.Contents>
        <Alert severity="error" title="Failed to load rule">
          {error.message}
        </Alert>
      </Page.Contents>
    );
  }
  if (!result) {
    return <AlertWarning title="Rule not found">Sorry! This rule does not exist.</AlertWarning>;
  }
  if (isEditable === false) {
    return <AlertWarning title="Cannot edit rule">Sorry! You do not have permission to edit this rule.</AlertWarning>;
  }
  return <AlertRuleForm existing={result} />;
};

type RuleEditorProps = GrafanaRouteComponentProps<{ id?: string }>;

const RuleEditor: FC<RuleEditorProps> = ({ match }) => {
  const { id } = match.params;
  const identifier = ruleId.tryParse(id, true);

  if (identifier) {
    return <ExistingRuleEditor key={id} identifier={identifier} />;
  }
  if (!(contextSrv.hasEditPermissionInFolders || contextSrv.isEditor)) {
    return <AlertWarning title="Cannot create rules">Sorry! You are not allowed to create rules.</AlertWarning>;
  }
  return <AlertRuleForm />;
};

const AlertWarning: FC<{ title: string }> = ({ title, children }) => (
  <Alert className={useStyles2(warningStyles).warning} severity="warning" title={title}>
    <p>{children}</p>
    <LinkButton href="alerting/list">To rule list</LinkButton>
  </Alert>
);

const warningStyles = (theme: GrafanaTheme2) => ({
  warning: css`
    margin: ${theme.spacing(4)};
  `,
});

export default withErrorBoundary(RuleEditor, { style: 'page' });
