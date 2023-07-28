import React from 'react';

const CHEAT_SHEET_ITEMS = [
  {
    title: 'Getting started',
    label:
      'Start by selecting a measurement and field from the dropdown above. You can then use the tag selector to further narrow your search.',
  },
];

export const InfluxCheatSheet = () => (
  <div>
    <h2>InfluxDB Cheat Sheet</h2>
    {CHEAT_SHEET_ITEMS.map((item) => (
      <div className="cheat-sheet-item" key={item.title}>
        <div className="cheat-sheet-item__title">{item.title}</div>
        <div className="cheat-sheet-item__label">{item.label}</div>
      </div>
    ))}
  </div>
);
