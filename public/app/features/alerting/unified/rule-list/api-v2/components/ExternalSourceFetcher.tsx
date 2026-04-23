import { useEffect } from 'react';

import { alertRuleApi } from '../../../api/alertRuleApi';
import { type ExternalSourceResult } from '../hooks/useRuleTree';

interface Props {
  uid: string;
  name: string;
  onResult: (uid: string, result: ExternalSourceResult) => void;
}

export function ExternalSourceFetcher({ uid, name, onResult }: Props) {
  const { data, isError, error } = alertRuleApi.endpoints.prometheusRuleNamespaces.useQuery(
    { ruleSourceName: name, limitAlerts: 0 },
    { pollingInterval: 120_000 }
  );

  useEffect(() => {
    onResult(uid, {
      namespaces: data,
      error: isError ? formatError(error) : undefined,
    });
  }, [uid, data, isError, error, onResult]);

  return null;
}

function formatError(err: unknown): string {
  const status = extractStatus(err);
  if (status === 'FETCH_ERROR') {
    return 'Failed to load rules: connection refused';
  }
  if (typeof status === 'number') {
    return `Failed to load rules: ${status}`;
  }
  return 'Failed to load rules';
}

function extractStatus(err: unknown): unknown {
  if (err && typeof err === 'object' && 'status' in err) {
    return err.status;
  }
  return undefined;
}
