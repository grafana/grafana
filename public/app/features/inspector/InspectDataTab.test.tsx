import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

import { DataFrame, FieldType } from '@grafana/data';

import { InspectDataTab } from './InspectDataTab';

const createProps = (propsOverride?: Partial<ComponentProps<typeof InspectDataTab>>) => {
  const defaultProps = {
    isLoading: false,
    options: {
      withTransforms: false,
      withFieldConfig: false,
    },
    data: [
      {
        name: 'First data frame',
        fields: [
          { name: 'time', type: FieldType.time, values: [100, 200, 300] },
          { name: 'name', type: FieldType.string, values: ['uniqueA', 'b', 'c'] },
          { name: 'value', type: FieldType.number, values: [1, 2, 3] },
        ],
        length: 3,
      },
      {
        name: 'Second data frame',
        fields: [
          { name: 'time', type: FieldType.time, values: [400, 500, 600] },
          { name: 'name', type: FieldType.string, values: ['d', 'e', 'g'] },
          { name: 'value', type: FieldType.number, values: [4, 5, 6] },
        ],
        length: 3,
      },
    ],
  };

  return Object.assign(defaultProps, propsOverride) as ComponentProps<typeof InspectDataTab>;
};

describe('InspectDataTab', () => {
  describe('when panel is not passed as prop (Explore)', () => {
    it('should render InspectDataTab', () => {
      render(<InspectDataTab {...createProps()} />);
      expect(screen.getByLabelText(/Panel inspector Data content/i)).toBeInTheDocument();
    });
    it('should render Data Option row', () => {
      render(<InspectDataTab {...createProps()} />);
      expect(screen.getByText(/Data options/i)).toBeInTheDocument();
    });
    it('should show available options', async () => {
      render(<InspectDataTab {...createProps()} />);
      const dataOptions = screen.getByText(/Data options/i);
      await userEvent.click(dataOptions);
      expect(screen.getByText(/Show data frame/i)).toBeInTheDocument();
      expect(screen.getByText(/Download for Excel/i)).toBeInTheDocument();
    });
    it('should show available dataFrame options', async () => {
      render(<InspectDataTab {...createProps()} />);
      const dataOptions = screen.getByText(/Data options/i);
      await userEvent.click(dataOptions);
      const dataFrameInput = screen.getByRole('combobox', { name: /Select dataframe/i });
      await userEvent.click(dataFrameInput);
      expect(screen.getByText(/Second data frame/i)).toBeInTheDocument();
    });
    it('should show download logs button if logs data', () => {
      const dataWithLogs = [
        {
          name: 'Data frame with logs',
          fields: [
            { name: 'time', type: FieldType.time, values: [100, 200, 300] },
            { name: 'name', type: FieldType.string, values: ['uniqueA', 'b', 'c'] },
            { name: 'value', type: FieldType.number, values: [1, 2, 3] },
          ],
          length: 3,
          meta: {
            preferredVisualisationType: 'logs',
          },
        },
      ] as unknown as DataFrame[];
      render(<InspectDataTab {...createProps({ data: dataWithLogs })} />);
      expect(screen.getByText(/Download logs/i)).toBeInTheDocument();
    });
    it('should not show download logs button if no logs data', () => {
      render(<InspectDataTab {...createProps()} />);
      expect(screen.queryByText(/Download logs/i)).not.toBeInTheDocument();
    });
    it('should show download traces button if traces data', () => {
      const dataWithtraces = [
        {
          name: 'Data frame with traces',
          fields: [
            { name: 'traceID', values: ['3fa414edcef6ad90', '3fa414edcef6ad90'] },
            { name: 'spanID', values: ['3fa414edcef6ad90', '0f5c1808567e4403'] },
            { name: 'parentSpanID', values: [undefined, '3fa414edcef6ad90'] },
            { name: 'operationName', values: ['HTTP GET - api_traces_traceid', '/tempopb.Querier/FindTraceByID'] },
            { name: 'serviceName', values: ['tempo-querier', 'tempo-querier'] },
            {
              name: 'serviceTags',
              values: [
                [
                  { key: 'cluster', type: 'string', value: 'ops-tools1' },
                  { key: 'container', type: 'string', value: 'tempo-query' },
                ],
                [
                  { key: 'cluster', type: 'string', value: 'ops-tools1' },
                  { key: 'container', type: 'string', value: 'tempo-query' },
                ],
              ],
            },
            { name: 'startTime', values: [1605873894680.409, 1605873894680.587] },
            { name: 'duration', values: [1049.141, 1.847] },
            { name: 'logs', values: [[], []] },
            {
              name: 'tags',
              values: [
                [
                  { key: 'sampler.type', type: 'string', value: 'probabilistic' },
                  { key: 'sampler.param', type: 'float64', value: 1 },
                ],
                [
                  { key: 'component', type: 'string', value: 'gRPC' },
                  { key: 'span.kind', type: 'string', value: 'client' },
                ],
              ],
            },
            { name: 'warnings', values: [undefined, undefined] },
            { name: 'stackTraces', values: [undefined, undefined] },
          ],
          length: 2,
          meta: {
            preferredVisualisationType: 'trace',
            custom: {
              traceFormat: 'jaeger',
            },
          },
        },
      ] as unknown as DataFrame[];
      render(<InspectDataTab {...createProps({ data: dataWithtraces })} />);
      expect(screen.getByText(/Download traces/i)).toBeInTheDocument();
    });
    it('should not show download traces button if no traces data', () => {
      render(<InspectDataTab {...createProps()} />);
      expect(screen.queryByText(/Download traces/i)).not.toBeInTheDocument();
    });
    it('should show download service graph button', () => {
      const sgFrames = [
        {
          name: 'Nodes',
          fields: [],
          meta: {
            preferredVisualisationType: 'nodeGraph',
          },
        },
        {
          name: 'Edges',
          fields: [],
          meta: {
            preferredVisualisationType: 'nodeGraph',
          },
        },
      ] as unknown as DataFrame[];
      render(
        <InspectDataTab
          {...createProps({
            data: sgFrames,
          })}
        />
      );
      expect(screen.getByText(/Download service graph/i)).toBeInTheDocument();
    });
  });
});
