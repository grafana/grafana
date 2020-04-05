import { connectWithProvider } from '../../utils/connectWithReduxStore';
import { ModalRoot, ModalsProvider } from '@grafana/ui';
import React from 'react';

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
