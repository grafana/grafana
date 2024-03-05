import React, { useState } from 'react';

import { EntityDrawer } from './EntityDrawer';
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
        style={{
          borderBottom: '3px solid orange',
        }}
        onClick={() => {
          setDrawerVisible(true);
        }}
      >
        {props.children}
      </span>

      {drawerVisible && (
        <EntityDrawer
          // TODO: make this more clever
          entity={'service:app'}
          title={`${props.context.key}: ${props.context.value}`}
          onClose={() => {
            setDrawerVisible(false);
          }}
        />
      )}
    </>
  );
}
