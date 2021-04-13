import { GrafanaRouteComponentProps } from 'app/core/navigation/types';
import React, { FC } from 'react';
import { AlertRuleForm } from './components/rule-editor/AlertRuleForm';
import { parseRuleIdentifier } from './utils/rules';

const RuleEditor: FC<GrafanaRouteComponentProps<{ id?: string }>> = ({ match }) => {
  const id = match.params.id;
  if (id) {
    console.log('loc', parseRuleIdentifier(decodeURIComponent(id)));
  }
  return <AlertRuleForm />;
};

export default RuleEditor;
