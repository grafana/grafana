import React, { FC } from 'react';

import { PlaylistTableRow } from './PlaylistTableRow';
import { PlaylistItem } from './types';

interface PlaylistTableRowsProps {
  items: PlaylistItem[];
  onMoveUp: (item: PlaylistItem) => void;
  onMoveDown: (item: PlaylistItem) => void;
  onDelete: (item: PlaylistItem) => void;
}

export const PlaylistTableRows: FC<PlaylistTableRowsProps> = ({ items, onMoveUp, onMoveDown, onDelete }) => {
  if (items.length === 0) {
    return (
      <tr>
        <td>
          <em>Playlist is empty. Add dashboards below.</em>
        </td>
      </tr>
    );
  }

  return (
    <>
      {items.map((item, index) => {
        const first = index === 0;
        const last = index === items.length - 1;
        return (
          <PlaylistTableRow
            first={first}
            last={last}
            item={item}
            onDelete={onDelete}
            onMoveDown={onMoveDown}
            onMoveUp={onMoveUp}
            key={item.title}
          />
        );
      })}
    </>
  );
};
