import React, { FC, useState } from 'react';
import { Redirect } from 'react-router-dom';

import KubernetesInventory from '../KubernetesInventory';

export type K8sPageMode = 'register' | 'edit' | 'list';

export const K8sRouting: FC = () => {
  const [mode, setMode] = useState<K8sPageMode>('list');

  return (
    <>
      {mode === 'register' && <Redirect to="/dbaas/kubernetes/registration" />}
      {mode === 'list' && <KubernetesInventory setMode={setMode} />}
    </>
  );
};

export default K8sRouting;
