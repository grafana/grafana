import React, { useState } from 'react';

import { EntityDrawer } from './EntityDrawer';
import { entityService } from './EntityService';

type Props = {
  children: React.ReactNode;
  context: { key: string; value: string };
};

export function EntityLink(props: Props) {
  const [drawerVisible, setDrawerVisible] = useState(false);

  const entityType = {
    compose_service: 'service',
    'service.name': 'service',
    namespace: 'namespace',
    container_name: 'container',
  }[props.context.key];

  if (!entityType) {
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
          entity={entityType + ':' + props.context.value}
          title={`${props.context.key}: ${props.context.value}`}
          onClose={() => {
            setDrawerVisible(false);
          }}
        />
      )}
    </>
  );
}
