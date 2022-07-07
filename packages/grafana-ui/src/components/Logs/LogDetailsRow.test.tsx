import { screen, render, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentProps } from 'react';

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
    onClickShowDetectedField: () => {},
    onClickHideDetectedField: () => {},
    showDetectedFields: [],
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
    expect(screen.getAllByTitle('Ad-hoc statistics')).toHaveLength(1);
  });

  describe('if props is a label', () => {
    it('should render filter label button', () => {
      setup();
      expect(screen.getAllByTitle('Filter for value')).toHaveLength(1);
    });
    it('should render filter out label button', () => {
      setup();
      expect(screen.getAllByTitle('Filter out value')).toHaveLength(1);
    });
    it('should not render filtering buttons if no filtering functions provided', () => {
      setup({ onClickFilterLabel: undefined, onClickFilterOutLabel: undefined });
      expect(screen.queryByTitle('Filter out value')).not.toBeInTheDocument();
    });
  });

  describe('if props is not a label', () => {
    it('should not render a filter label button', () => {
      setup({ isLabel: false });
      expect(screen.queryByTitle('Filter for value')).not.toBeInTheDocument();
    });
    it('should render a show toggleFieldButton button', () => {
      setup({ isLabel: false });
      expect(screen.getAllByTitle('Show this field instead of the message')).toHaveLength(1);
    });
    it('should not render a show toggleFieldButton button if no detected fields toggling functions provided', () => {
      setup({
        isLabel: false,
        onClickShowDetectedField: undefined,
        onClickHideDetectedField: undefined,
      });
      expect(screen.queryByTitle('Show this field instead of the message')).not.toBeInTheDocument();
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
    const adHocStatsButton = screen.getByTitle('Ad-hoc statistics');
    fireEvent.click(adHocStatsButton);
    expect(screen.getByTestId('logLabelStats')).toBeInTheDocument();
    expect(screen.getByTestId('logLabelStats')).toHaveTextContent('another value');
  });

  it('should render clipboard button on hover of log row table value', async () => {
    setup({ parsedKey: 'key', parsedValue: 'value' });

    const valueCell = screen.getByRole('cell', { name: 'value' });
    await userEvent.hover(valueCell);

    expect(screen.getByRole('button', { name: 'Copy value to clipboard' })).toBeInTheDocument();
    await userEvent.unhover(valueCell);

    expect(screen.queryByRole('button', { name: 'Copy value to clipboard' })).not.toBeInTheDocument();
  });
});
