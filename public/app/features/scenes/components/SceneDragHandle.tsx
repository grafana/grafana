import React from 'react';

import { Icon } from '@grafana/ui';

export function SceneDragHandle({ layoutKey, className }: { layoutKey: string; className?: string }) {
  return (
    <div
      className={`${className} grid-drag-handle-${layoutKey}`}
      style={{
        width: '20px',
        height: '20px',
        cursor: 'move',
      }}
    >
      <Icon name="draggabledots" />
    </div>
  );
}
