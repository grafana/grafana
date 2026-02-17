import { render, screen } from '@testing-library/react';

import { EventBusSrv } from '@grafana/data';

import { PanelContextProvider } from '../PanelChrome';

import { VizLegendSeriesIcon } from './VizLegendSeriesIcon';

describe('VizLegendSeriesIcon', () => {
  const mockOnSeriesColorChange = jest.fn();

  const mockPanelContext = {
    eventsScope: 'global',
    eventBus: new EventBusSrv(),
    onSeriesColorChange: mockOnSeriesColorChange,
  };

  describe('keyboard accessibility', () => {
    it('should render a focusable icon with tabIndex when editable', () => {
      render(
        <PanelContextProvider value={mockPanelContext}>
          <VizLegendSeriesIcon seriesName="test-series" color="blue" />
        </PanelContextProvider>
      );

      const icon = screen.getByTestId('series-icon');
      expect(icon).toHaveAttribute('tabindex', '0');
    });

    it('should not have tabIndex when readonly', () => {
      render(<VizLegendSeriesIcon seriesName="test-series" color="blue" readonly={true} />);

      const icon = screen.getByTestId('series-icon');
      expect(icon).not.toHaveAttribute('tabindex');
    });
  });
});
