import { fireEvent, render, screen } from '@testing-library/react';
import { ComponentProps } from 'react';

import { Field, CoreApp, FieldType, LinkModel } from '@grafana/data';

import { LogDetailsRow } from './LogDetailsRow';
import { createLogRow } from './mocks/logRow';

type Props = ComponentProps<typeof LogDetailsRow>;

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    parsedValues: ['value'],
    parsedKeys: ['key'],
    isLabel: true,
    wrapLogMessage: false,
    getStats: () => null,
    onClickFilterLabel: () => {},
    onClickFilterOutLabel: () => {},
    onClickShowField: () => {},
    onClickHideField: () => {},
    displayedFields: [],
    row: createLogRow(),
    disableActions: false,
    app: CoreApp.Explore,
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
    setup({ parsedKeys: ['test key'] });
    expect(screen.getByText('test key')).toBeInTheDocument();
  });
  it('should render parsed value', () => {
    setup({ parsedValues: ['test value'] });
    expect(screen.getByText('test value')).toBeInTheDocument();
  });

  it('should render metrics button', () => {
    setup();
    expect(screen.getAllByRole('button', { name: 'Ad-hoc statistics' })).toHaveLength(1);
  });

  describe('toggleable filters', () => {
    it('should render filter buttons', () => {
      setup();
      expect(screen.getAllByRole('button', { name: 'Filter for value in query A' })).toHaveLength(1);
      expect(screen.getAllByRole('button', { name: 'Filter out value in query A' })).toHaveLength(1);
      expect(screen.queryByRole('button', { name: 'Remove filter in query A' })).not.toBeInTheDocument();
    });
    it('should render remove filter button when the filter is active', async () => {
      setup({
        isFilterLabelActive: jest.fn().mockResolvedValue(true),
      });
      expect(await screen.findByRole('button', { name: 'Remove filter in query A' })).toBeInTheDocument();
    });
    it('should trigger a call to `onClickFilterOutLabel` when the filter out button is clicked', () => {
      const onClickFilterOutLabel = jest.fn();
      setup({ onClickFilterOutLabel });
      fireEvent.click(screen.getByRole('button', { name: 'Filter out value in query A' }));
      expect(onClickFilterOutLabel).toHaveBeenCalledWith(
        'key',
        'value',
        expect.objectContaining({
          fields: [
            expect.objectContaining({ values: [0] }),
            expect.objectContaining({ values: ['line1'] }),
            expect.objectContaining({ values: [{ app: 'app01' }] }),
          ],
          length: 1,
        })
      );
    });
    it('should trigger a call to `onClickFilterLabel` when the filter  button is clicked', () => {
      const onClickFilterLabel = jest.fn();
      setup({ onClickFilterLabel });
      fireEvent.click(screen.getByRole('button', { name: 'Filter for value in query A' }));
      expect(onClickFilterLabel).toHaveBeenCalledWith(
        'key',
        'value',
        expect.objectContaining({
          fields: [
            expect.objectContaining({ values: [0] }),
            expect.objectContaining({ values: ['line1'] }),
            expect.objectContaining({ values: [{ app: 'app01' }] }),
          ],
          length: 1,
        })
      );
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
      parsedKeys: ['key'],
      parsedValues: ['value'],
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

  describe('copy button', () => {
    it('should be invisible unless mouse is over', () => {
      setup({ parsedValues: ['test value'] });
      // This tests a regression where the button was always visible.
      expect(screen.getByTitle('Copy value to clipboard')).not.toBeVisible();
      // Asserting visibility on mouse-over is currently not possible.
    });
  });

  describe('datalinks', () => {
    it('datalinks should pin and call the original link click', () => {
      const onLinkClick = jest.fn();
      const onPinLine = jest.fn();
      const links: Array<LinkModel<Field>> = [
        {
          onClick: onLinkClick,
          href: '#',
          title: 'Hello link',
          target: '_self',
          origin: {
            name: 'name',
            type: FieldType.string,
            config: {},
            values: ['string'],
          },
        },
      ];
      setup({ links, onPinLine });

      expect(onLinkClick).not.toHaveBeenCalled();
      expect(onPinLine).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole('button', { name: 'Hello link' }));

      expect(onLinkClick).toHaveBeenCalled();
      expect(onPinLine).toHaveBeenCalled();
    });
  });
});
