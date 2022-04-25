import React from 'react';

import { ModalRoot, ModalsProvider } from '@grafana/ui';

import { connectWithProvider } from '../../utils/connectWithReduxStore';

/**
 * Component that enables rendering React modals from Angular
 */
export const AngularModalProxy = connectWithProvider((props: any) => {
  return (
    <>
      <ModalsProvider {...props}>
        <ModalRoot />
      </ModalsProvider>
    </>
  );
});
