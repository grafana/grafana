import { screen, render, fireEvent } from '@testing-library/react';
import React, { ComponentProps } from 'react';

import { LogRowModel } from '@grafana/data';

import { LogDetailsRow } from './LogDetailsRow';

type Props = ComponentProps<typeof LogDetailsRow>;

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    parsedValue: '',
    parsedKey: '',
    isLabel: true,
    wrapLogMessage: false,
    getStats: () => null,
    onClickFilterLabel: () => {},
    onClickFilterOutLabel: () => {},
    onClickShowField: () => {},
    onClickHideField: () => {},
    displayedFields: [],
    row: {} as LogRowModel,
  };

  Object.assign(props, propOverrides);

  return render(
    <table>
      <tbody>
        <LogDetailsRow {...props} />
      </tbody>
    </table>
  );
};

jest.mock('@grafana/runtime', () => ({
  ...jest.requireActual('@grafana/runtime'),
  reportInteraction: jest.fn(),
}));

describe('LogDetailsRow', () => {
  it('should render parsed key', () => {
    setup({ parsedKey: 'test key' });
    expect(screen.getByText('test key')).toBeInTheDocument();
  });
  it('should render parsed value', () => {
    setup({ parsedValue: 'test value' });
    expect(screen.getByText('test value')).toBeInTheDocument();
  });

  it('should render metrics button', () => {
    setup();
    expect(screen.getAllByRole('button', { name: 'Ad-hoc statistics' })).toHaveLength(1);
  });

  describe('if props is a label', () => {
    it('should render filter label button', () => {
      setup();
      expect(screen.getAllByRole('button', { name: 'Filter for value' })).toHaveLength(1);
    });
    it('should render filter out label button', () => {
      setup();
      expect(screen.getAllByRole('button', { name: 'Filter out value' })).toHaveLength(1);
    });
  });

  describe('if props is not a label', () => {
    it('should render a show toggleFieldButton button', () => {
      setup({ isLabel: false });
      expect(screen.getAllByRole('button', { name: 'Show this field instead of the message' })).toHaveLength(1);
    });
  });

  it('should render stats when stats icon is clicked', () => {
    setup({
      parsedKey: 'key',
      parsedValue: 'value',
      getStats: () => {
        return [
          {
            count: 1,
            proportion: 1 / 2,
            value: 'value',
          },
          {
            count: 1,
            proportion: 1 / 2,
            value: 'another value',
          },
        ];
      },
    });

    expect(screen.queryByTestId('logLabelStats')).not.toBeInTheDocument();
    const adHocStatsButton = screen.getByRole('button', { name: 'Ad-hoc statistics' });
    fireEvent.click(adHocStatsButton);
    expect(screen.getByTestId('logLabelStats')).toBeInTheDocument();
    expect(screen.getByTestId('logLabelStats')).toHaveTextContent('another value');
  });
});
