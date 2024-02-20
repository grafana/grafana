import React, { useState } from 'react';

import { Drawer } from '@grafana/ui';

import { entityService } from './EntityService';

type Props = {
  children: React.ReactNode;
  context: { key: string; value: string };
};

export function EntityLink(props: Props) {
  const [drawerVisible, setDrawerVisible] = useState(false);
  const entities = entityService.getEntitiesForKeys([props.context.key]);
  if (entities.length === 0) {
    return <>{props.children}</>;
  }

  return (
    <>
      <span
        role={'button'}
        onClick={() => {
          setDrawerVisible(true);
        }}
      >
        {props.children}
      </span>

      {drawerVisible && (
        <Drawer
          closeOnMaskClick={true}
          title={`${props.context.key}: ${props.context.value}`}
          onClose={() => {
            setDrawerVisible(false);
          }}
        >
          somethings
        </Drawer>
      )}
    </>
  );
}
