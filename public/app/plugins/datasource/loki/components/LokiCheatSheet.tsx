import React from 'react';

const CHEAT_SHEET_ITEMS = [
  {
    title: 'See your logs',
    label: 'Start by selecting a log stream from the Log labels selector.',
  },
  {
    title: 'Logs from a "job"',
    expression: '{job="default/prometheus"}',
    label: 'Returns all log lines emitted by instances of this job.',
  },
  {
    title: 'Combine stream selectors',
    expression: '{app="cassandra",namespace="prod"}',
    label: 'Returns all log lines from streams that have both labels.',
  },
  {
    title: 'Search for text',
    expression: '{app="cassandra"} (duration|latency)\\s*(=|is|of)\\s*[\\d\\.]+',
    label: 'Add a regular expression after the selector to filter for.',
  },
];

export default (props: any) => (
  <div>
    <h2>Loki Cheat Sheet</h2>
    {CHEAT_SHEET_ITEMS.map(item => (
      <div className="cheat-sheet-item" key={item.title}>
        <div className="cheat-sheet-item__title">{item.title}</div>
        {item.expression && (
          <div
            className="cheat-sheet-item__expression"
            onClick={e => props.onClickExample({ refId: 'A', expr: item.expression })}
          >
            <code>{item.expression}</code>
          </div>
        )}
        <div className="cheat-sheet-item__label">{item.label}</div>
      </div>
    ))}
  </div>
);
