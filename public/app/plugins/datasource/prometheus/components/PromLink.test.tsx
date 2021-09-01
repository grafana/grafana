import React from 'react';
import { render, screen } from '@testing-library/react';
import { PanelData } from '@grafana/data';
import { PromQuery } from '../types';
import { PrometheusDatasource } from '../datasource';
import PromLink from './PromLink';

const getPanelData = (panelDataOverrides?: Partial<PanelData>) => {
  const panelData = {
    request: {
      targets: [
        { refId: 'A', datasource: 'prom1' },
        { refId: 'B', datasource: 'prom2' },
      ],
      range: {
        to: {
          utc: () => ({
            format: jest.fn(),
          }),
        },
      },
    },
  };

  return Object.assign(panelData, panelDataOverrides) as PanelData;
};

const getDataSource = (datasourceOverrides?: Partial<PrometheusDatasource>) => {
  const datasource = {
    getPrometheusTime: () => 123,
    createQuery: () => ({ expr: 'up', step: 15 }),
    directUrl: 'prom1',
  };

  return (Object.assign(datasource, datasourceOverrides) as unknown) as PrometheusDatasource;
};

describe('PromLink', () => {
  it('should show correct link for 1 component', async () => {
    render(
      <div>
        <PromLink datasource={getDataSource()} panelData={getPanelData()} query={{} as PromQuery} />
      </div>
    );
    expect(screen.getByText('Prometheus')).toHaveAttribute(
      'href',
      'prom1/graph?g0.expr=up&g0.range_input=0s&g0.end_input=undefined&g0.step_input=15&g0.tab=0'
    );
  });
  it('should show different link when there are 2 components with the same panel data', () => {
    render(
      <div>
        <PromLink datasource={getDataSource()} panelData={getPanelData()} query={{} as PromQuery} />
        <PromLink datasource={getDataSource({ directUrl: 'prom2' })} panelData={getPanelData()} query={{} as any} />
      </div>
    );
    const promLinkButtons = screen.getAllByText('Prometheus');
    expect(promLinkButtons[0]).toHaveAttribute(
      'href',
      'prom1/graph?g0.expr=up&g0.range_input=0s&g0.end_input=undefined&g0.step_input=15&g0.tab=0'
    );
    expect(promLinkButtons[1]).toHaveAttribute(
      'href',
      'prom2/graph?g0.expr=up&g0.range_input=0s&g0.end_input=undefined&g0.step_input=15&g0.tab=0'
    );
  });
  it('should create sanitized link', async () => {
    render(
      <div>
        <PromLink
          datasource={getDataSource({ directUrl: "javascript:300?1:2;alert('Hello');//" })}
          panelData={getPanelData()}
          query={{} as PromQuery}
        />
      </div>
    );
    expect(screen.getByText('Prometheus')).toHaveAttribute('href', 'about:blank');
  });
});
