import React, { MouseEvent } from 'react';
import { ContextMenu } from '..';
import { LinkModel } from '@grafana/data';

export function GraphContextMenu({
  header,
  onClose,
  links,
  event,
}: {
  header: React.ReactNode;
  onClose: () => void;
  links: LinkModel[];
  event: MouseEvent;
}) {
  if (!links.length) {
    return null;
  }

  return (
    <ContextMenu
      renderHeader={() => header}
      items={[
        {
          label: 'Open in Explore',
          items: links.map(link => ({
            label: link.title,
            url: link.href,
            onClick: link.onClick,
          })),
        },
      ]}
      onClose={onClose}
      x={event.pageX}
      y={event.pageY}
    />
  );
}
