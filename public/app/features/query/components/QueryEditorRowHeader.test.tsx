import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Props, QueryEditorRowHeader } from './QueryEditorRowHeader';
import { DataSourceInstanceSettings } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => {
  return {
    getDataSourceSrv: () => ({
      getInstanceSettings: jest.fn(),
      getList: jest.fn().mockReturnValue([]),
    }),
  };
});

describe('QueryEditorRowHeader', () => {
  it('Can edit title', () => {
    const scenario = renderScenario({});
    screen.getByTestId('query-name-div').click();

    const input = screen.getByTestId('query-name-input');
    fireEvent.change(input, { target: { value: 'new name' } });
    fireEvent.blur(input);

    expect((scenario.props.onChange as any).mock.calls[0][0].refId).toBe('new name');
  });

  it('Show error when other query with same name exists', async () => {
    renderScenario({});

    screen.getByTestId('query-name-div').click();
    const input = screen.getByTestId('query-name-input');
    fireEvent.change(input, { target: { value: 'B' } });
    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe('Query name already exists');
  });

  it('Show error when empty name is specified', async () => {
    renderScenario({});

    screen.getByTestId('query-name-div').click();
    const input = screen.getByTestId('query-name-input');
    fireEvent.change(input, { target: { value: '' } });
    const alert = await screen.findByRole('alert');

    expect(alert.textContent).toBe('An empty query name is not allowed');
  });

  it('should show data source picker when callback is passed', async () => {
    renderScenario({ onChangeDataSource: () => {} });

    expect(screen.queryByLabelText(selectors.components.DataSourcePicker.container)).not.toBeNull();
  });

  it('should not show data source picker when no callback is passed', async () => {
    renderScenario({ onChangeDataSource: undefined });

    expect(screen.queryByLabelText(selectors.components.DataSourcePicker.container)).toBeNull();
  });
});

function renderScenario(overrides: Partial<Props>) {
  const props: Props = {
    query: {
      refId: 'A',
    },
    queries: [
      {
        refId: 'A',
      },
      {
        refId: 'B',
      },
    ],
    dataSource: {} as DataSourceInstanceSettings,
    disabled: false,
    onChange: jest.fn(),
    onClick: jest.fn(),
    collapsedText: '',
  };

  Object.assign(props, overrides);

  return {
    props,
    renderResult: render(<QueryEditorRowHeader {...props} />),
  };
}
