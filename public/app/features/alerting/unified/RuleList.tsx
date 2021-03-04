import React, { FC, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AlertingPageWrapper } from './components/AlertingPageWrapper';
import { useUnifiedAlertingSelector } from './hooks/useUnifiedAlertingSelector';
import { fetchRulesAction } from './state/actions';

export const RuleList: FC = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(fetchRulesAction());
  }, []);

  const { loading, result, error } = useUnifiedAlertingSelector((state) => state.rules);

  return (
    <AlertingPageWrapper isLoading={loading}>
      {error !== undefined && <p>Error while loading rules.</p>}
      {result &&
        result.map(({ error, namespaces, datasourceName }) => (
          <p key={datasourceName}>
            <strong>{datasourceName}</strong> <br />
            {error && 'Error loading rules.'}
            {namespaces && `${namespaces.length} namespaces`}
          </p>
        ))}
    </AlertingPageWrapper>
  );
};
