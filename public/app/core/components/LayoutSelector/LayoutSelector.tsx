import React from 'react';

export default function LayoutSelector({ mode, onLayoutModeChanged }) {
  return (
    <div className="layout-selector">
      <button
        onClick={() => {
          onLayoutModeChanged('list');
        }}
        className={mode === 'list' ? 'active' : ''}
      >
        <i className="fa fa-list" />
      </button>
      <button
        onClick={() => {
          onLayoutModeChanged('grid');
        }}
        className={mode === 'grid' ? 'active' : ''}
      >
        <i className="fa fa-th" />
      </button>
    </div>
  );
}
