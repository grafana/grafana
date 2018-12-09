import React from 'react';

const CHEAT_SHEET_ITEMS = [
  {
    title: 'See your logs',
    label: 'Start by selecting a log stream from the Log Labels selector.',
  },
  {
    title: 'Logs From a Job',
    expression: '{job="default/prometheus"}',
    label: 'Returns all log lines emitted by instances of this job.',
  },
  {
    title: 'Combine Stream Selectors',
    expression: '{app="cassandra",namespace="prod"}',
    label: 'Returns all log lines from streams that have both labels.',
  },
  {
    title: 'Search For Text',
    expression: '{app="cassandra"} (duration|latency)\\s*(=|is|of)\\s*[\\d\\.]+',
    label: 'The right search field takes a regular expression to search for.',
  },
];

export default (props: any) => (
  <div>
    <h2>Loki Cheat Sheet</h2>
    {CHEAT_SHEET_ITEMS.map(item => (
      <div className="cheat-sheet-item" key={item.expression}>
        <div className="cheat-sheet-item__title">{item.title}</div>
        {item.expression && (
          <div
            className="cheat-sheet-item__expression"
            onClick={e => props.onClickExample({ refId: '1', expr: item.expression })}
          >
            <code>{item.expression}</code>
          </div>
        )}
        <div className="cheat-sheet-item__label">{item.label}</div>
      </div>
    ))}
  </div>
);
