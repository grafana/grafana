import React from 'react';
import { useAsync } from 'react-use';

import { Spinner, Alert } from '@grafana/ui';

import { dashboardKindService } from '../../services/k8service';

type Props = {
  name: string;
};

export const K8sResourceHistory = ({ name }: Props) => {
  const history = useAsync(async () => {
    return dashboardKindService.getHistory(name);
  }, [name]);

  if (history.loading) {
    return <Spinner />
  }
  if (history.value) {
    return <div>
      <pre>{JSON.stringify(history.value, null, '  ')}</pre>
    </div>
  }
  if (history.error) {
    return <div>
      <Alert title='error reading history'>{JSON.stringify(history.error, null, '  ')}</Alert>
    </div>
  }
  return <div>
    history?
  </div>
};



export const K8sResourceRefs = ({ name }: Props) => {
  const refs = useAsync(async () => {
    return dashboardKindService.getReferences(name);
  }, [name]);

  if (refs.loading) {
    return <Spinner />
  }
  if (refs.value) {
    return <div>
      <pre>{JSON.stringify(refs.value, null, '  ')}</pre>
    </div>
  }
  if (refs.error) {
    return <div>
      <Alert title='error reading refs'>{JSON.stringify(refs.error, null, '  ')}</Alert>
    </div>
  }
  return <div>
    refs?
  </div>
};

