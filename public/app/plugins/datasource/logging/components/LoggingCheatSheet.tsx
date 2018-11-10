import React from 'react';

const CHEAT_SHEET_ITEMS = [
  {
    title: 'Logs From a Job',
    expression: '{job="default/prometheus"}',
    label: 'Returns all log lines emitted by instances of this job.',
  },
  {
    title: 'Search For Text',
    expression: '{app="cassandra"} Maximum memory usage',
    label: 'Returns all log lines for the selector and highlights the given text in the results.',
  },
];

export default (props: any) => (
  <div>
    <h1>Logging Cheat Sheet</h1>
    {CHEAT_SHEET_ITEMS.map(item => (
      <div className="cheat-sheet-item" key={item.expression}>
        <div className="cheat-sheet-item__title">{item.title}</div>
        <div className="cheat-sheet-item__expression" onClick={e => props.onClickQuery(item.expression)}>
          <code>{item.expression}</code>
        </div>
        <div className="cheat-sheet-item__label">{item.label}</div>
      </div>
    ))}
  </div>
);
