import { render, waitFor, screen } from '@testing-library/react';
import React, { ComponentProps } from 'react';

import {
  createTheme,
  DataFrame,
  ExploreLogsPanelState,
  FieldType,
  LogsSortOrder,
  standardTransformersRegistry,
  toUtc,
} from '@grafana/data/src';
import { organizeFieldsTransformer } from '@grafana/data/src/transformations/transformers/organize';

import { extractFieldsTransformer } from '../../transformers/extractFields/extractFields';

import { LogsTableWrap } from './LogsTableWrap';

const getComponent = (partialProps?: Partial<ComponentProps<typeof LogsTableWrap>>, logs?: DataFrame) => {
  const testDataFrame = {
    fields: [
      {
        config: {},
        name: 'Time',
        type: FieldType.time,
        values: ['2019-01-01 10:00:00', '2019-01-01 11:00:00', '2019-01-01 12:00:00'],
      },
      {
        config: {},
        name: 'line',
        type: FieldType.string,
        values: ['log message 1', 'log message 2', 'log message 3'],
      },
      {
        config: {},
        name: 'tsNs',
        type: FieldType.string,
        values: ['ts1', 'ts2', 'ts3'],
      },
      {
        config: {},
        name: 'labels',
        type: FieldType.other,
        typeInfo: {
          frame: 'json.RawMessage',
        },
        values: [{ foo: 'bar' }, { foo: 'bar' }, { foo: 'bar' }],
      },
    ],
    length: 3,
  };
  return (
    <LogsTableWrap
      range={{
        from: toUtc('2019-01-01 10:00:00'),
        to: toUtc('2019-01-01 16:00:00'),
        raw: { from: 'now-1h', to: 'now' },
      }}
      datasourceType={'loki'}
      onClickFilterOutLabel={() => undefined}
      onClickFilterLabel={() => undefined}
      updatePanelState={() => undefined}
      panelState={undefined}
      logsSortOrder={LogsSortOrder.Descending}
      splitOpen={() => undefined}
      timeZone={'utc'}
      width={50}
      logsFrames={[logs ?? testDataFrame]}
      theme={createTheme()}
      {...partialProps}
    />
  );
};
const setup = (partialProps?: Partial<ComponentProps<typeof LogsTableWrap>>, logs?: DataFrame) => {
  return render(getComponent(partialProps, logs));
};

describe('LogsTableWrap', () => {
  beforeAll(() => {
    const transformers = [extractFieldsTransformer, organizeFieldsTransformer];
    standardTransformersRegistry.setInit(() => {
      return transformers.map((t) => {
        return {
          id: t.id,
          aliasIds: t.aliasIds,
          name: t.name,
          transformation: t,
          description: t.description,
          editor: () => null,
        };
      });
    });
  });

  it('should render 4 table rows', async () => {
    setup();

    await waitFor(() => {
      const rows = screen.getAllByRole('row');
      // tableFrame has 3 rows + 1 header row
      expect(rows.length).toBe(4);
    });
  });

  it('updatePanelState should be called when a column is selected', async () => {
    const updatePanelState = jest.fn() as (panelState: Partial<ExploreLogsPanelState>) => void;
    setup({
      panelState: {
        visualisationType: 'table',
        columns: undefined,
      },
      updatePanelState: updatePanelState,
    });

    expect.assertions(3);

    const checkboxLabel = screen.getByLabelText('foo');
    expect(checkboxLabel).toBeInTheDocument();

    // Add a new column
    await waitFor(() => {
      checkboxLabel.click();
      expect(updatePanelState).toBeCalledWith({
        visualisationType: 'table',
        columns: { 0: 'foo' },
      });
    });

    // Remove the same column
    await waitFor(() => {
      checkboxLabel.click();
      expect(updatePanelState).toBeCalledWith({
        visualisationType: 'table',
        columns: {},
      });
    });
  });
});
