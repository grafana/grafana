import { screen, render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComponentProps } from 'react';

import { DataSourceApi } from '@grafana/data';
import { QueryBuilderOperation, QueryBuilderOperationParamDef } from '@grafana/plugin-ui';

import { LokiDatasource } from '../../datasource';
import { createLokiDatasource } from '../../mocks/datasource';
import { LokiQueryModeller } from '../LokiQueryModeller';
import { LokiOperationId } from '../types';

import { LabelParamEditor } from './LabelParamEditor';

describe('LabelParamEditor', () => {
  it('shows label options', async () => {
    const props = createProps({}, ['label1', 'label2']);
    render(<LabelParamEditor {...props} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByText('label1')).toBeInTheDocument();
    expect(screen.getByText('label2')).toBeInTheDocument();
  });

  it('shows no label options if no samples are returned', async () => {
    const props = createProps();
    render(<LabelParamEditor {...props} />);
    const input = screen.getByRole('combobox');
    await userEvent.click(input);
    expect(screen.getByText('No labels found')).toBeInTheDocument();
  });
});

const createProps = (propsOverrides?: Partial<ComponentProps<typeof LabelParamEditor>>, mockedSample?: string[]) => {
  const propsDefault = {
    value: undefined,
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
    index: 1,
    operationId: '1',
    query: {
      labels: [{ op: '=', label: 'foo', value: 'bar' }],
      operations: [
        { id: LokiOperationId.CountOverTime, params: ['5m'] },
        { id: '__sum_by', params: ['job'] },
      ],
    },
    paramDef: {} as QueryBuilderOperationParamDef,
    operation: {} as QueryBuilderOperation,
    datasource: createLokiDatasource() as DataSourceApi,
    queryModeller: {
      renderLabels: jest.fn().mockReturnValue('sum by(job) (count_over_time({foo="bar"} [5m]))'),
    } as unknown as LokiQueryModeller,
  };
  const props = { ...propsDefault, ...propsOverrides };

  if (props.datasource instanceof LokiDatasource) {
    const resolvedValue = mockedSample ?? [];
    props.datasource.languageProvider.fetchLabels = jest.fn().mockResolvedValue(resolvedValue);
  }
  return props;
};
