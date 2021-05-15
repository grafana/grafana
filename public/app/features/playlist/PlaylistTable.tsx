import React, { FC } from 'react';

import { PlaylistTableRows } from './PlaylistTableRows';
import { PlaylistItem } from './types';

interface PlaylistTableProps {
  items: PlaylistItem[];
  onMoveUp: (item: PlaylistItem) => void;
  onMoveDown: (item: PlaylistItem) => void;
  onDelete: (item: PlaylistItem) => void;
}

export const PlaylistTable: FC<PlaylistTableProps> = ({ items, onMoveUp, onMoveDown, onDelete }) => {
  return (
    <div className="gf-form-group">
      <h3 className="page-headering">Dashboards</h3>

      <table className="filter-table">
        <tbody>
          <PlaylistTableRows items={items} onMoveUp={onMoveUp} onMoveDown={onMoveDown} onDelete={onDelete} />
        </tbody>
      </table>
    </div>
  );
};
