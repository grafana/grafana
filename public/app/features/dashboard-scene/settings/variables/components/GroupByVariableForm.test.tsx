import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { VariableSupportType } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { mockDataSource } from 'app/features/alerting/unified/mocks';
import { LegacyVariableQueryEditor } from 'app/features/variables/editor/LegacyVariableQueryEditor';

import { GroupByVariableForm, GroupByVariableFormProps } from './GroupByVariableForm';

const defaultDatasource = mockDataSource({
  name: 'Default Test Data Source',
  type: 'test',
});

const promDatasource = mockDataSource({
  name: 'Prometheus',
  type: 'prometheus',
});

jest.mock('@grafana/runtime/src/services/dataSourceSrv', () => ({
  ...jest.requireActual('@grafana/runtime/src/services/dataSourceSrv'),
  getDataSourceSrv: () => ({
    get: async () => ({
      ...defaultDatasource,
      variables: {
        getType: () => VariableSupportType.Custom,
        query: jest.fn(),
        editor: jest.fn().mockImplementation(LegacyVariableQueryEditor),
      },
    }),
    getList: () => [defaultDatasource, promDatasource],
    getInstanceSettings: () => ({ ...defaultDatasource }),
  }),
}));

describe('GroupByVariableForm', () => {
  const onDataSourceChangeMock = jest.fn();
  const onDefaultOptionsChangeMock = jest.fn();

  const defaultProps: GroupByVariableFormProps = {
    onDataSourceChange: onDataSourceChangeMock,
    onDefaultOptionsChange: onDefaultOptionsChangeMock,
  };

  function setup(props?: React.ComponentProps<typeof GroupByVariableForm>) {
    return {
      renderer: render(<GroupByVariableForm {...defaultProps} {...props} />),
      user: userEvent.setup(),
    };
  }

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should call onDataSourceChange when changing the datasource', async () => {
    const {
      renderer: { getByTestId },
    } = setup();
    const dataSourcePicker = getByTestId(selectors.components.DataSourcePicker.inputV2);
    await userEvent.click(dataSourcePicker);
    await userEvent.click(screen.getByText(/prometheus/i));

    expect(onDataSourceChangeMock).toHaveBeenCalledTimes(1);
    expect(onDataSourceChangeMock).toHaveBeenCalledWith(promDatasource, undefined);
  });
});
