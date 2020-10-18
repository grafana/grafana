import { Tag } from '@grafana/ui';
import React from 'react';
import { Exemplar, ExemplarTraceIDDestination, PromMetric } from '../types';

interface Props {
  exemplar: Exemplar;
  seriesLabels: PromMetric;
  exemplarTraceIDDestination?: ExemplarTraceIDDestination;
}

export function ExemplarInfo({ exemplar, seriesLabels, exemplarTraceIDDestination }: Props) {
  let traceIDComponent: React.ReactNode;
  if (exemplarTraceIDDestination) {
    const traceID = exemplar.labels[exemplarTraceIDDestination.name];
    const href = exemplarTraceIDDestination.url.replace('${value}', traceID);
    const anchorElement = (
      <a href={href} rel="noopener" target="_blank">
        <Tag name={traceID} colorIndex={6} />
      </a>
    );
    traceIDComponent = anchorElement;
  }

  return (
    <div>
      <div style={{ padding: 10 }}>Series labels</div>
      <table className="exemplars-table">
        <tbody>
          {Object.keys(seriesLabels).map(label => (
            <tr key={label}>
              <td>{label}</td>
              <td>{seriesLabels[label]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ padding: 10 }}>Exemplar</div>
      <table className="exemplars-table">
        <tbody>
          {Object.keys(exemplar.labels).map(label => {
            return (
              <tr key={label}>
                <td>{label}</td>
                <td>{label === exemplarTraceIDDestination?.name ? traceIDComponent : exemplar.labels[label]}</td>
              </tr>
            );
          })}
          <tr>
            <td>timestamp</td>
            <td>{exemplar.timestamp}</td>
          </tr>
          <tr>
            <td>Value</td>
            <td>{exemplar.value}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

export const getExemplarInfoComponent = (
  exemplar: Exemplar,
  seriesLabels: PromMetric,
  exemplarTraceIDDestination?: ExemplarTraceIDDestination
) => (
  <ExemplarInfo
    exemplar={exemplar}
    seriesLabels={seriesLabels}
    exemplarTraceIDDestination={exemplarTraceIDDestination}
  />
);
