import React, { FC, useMemo } from 'react';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { RulesSource } from './components/rules/RulesSource';
import { getAllDataSources } from './utils/config';
import { RulesDatasourceTypes } from './utils/datasource';

export const RuleList: FC = () => {
  const rulesDatasources = useMemo(
    () =>
      getAllDataSources()
        .filter((ds) => RulesDatasourceTypes.includes(ds.type))
        .sort((a, b) => a.name.localeCompare(b.name)),
    []
  );

  return (
    <AlertingPageWrapper>
      {rulesDatasources.map((rulesSource) => (
        <RulesSource key={rulesSource.name} datasourceName={rulesSource.name} />
      ))}
    </AlertingPageWrapper>
  );
};
