import { render, screen } from '@testing-library/react';

import { selectors } from '@grafana/e2e-selectors';

import { VizLayout } from './VizLayout';

jest.mock('react-use', () => ({
  ...jest.requireActual('react-use'),
  useMeasure: jest.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const mockUseMeasure: jest.Mock = require('react-use').useMeasure;

const noMeasure = { width: 0, height: 0, top: 0, left: 0, bottom: 0, right: 0, x: 0, y: 0 };

describe('VizLayout', () => {
  beforeEach(() => {
    mockUseMeasure.mockReturnValue([jest.fn(), noMeasure]);
    Object.defineProperty(document.body, 'clientWidth', { value: 2000, configurable: true });
  });

  afterEach(() => {
    Object.defineProperty(document.body, 'clientWidth', { value: 0, configurable: true });
  });

  describe('without legend', () => {
    it('renders container with correct testid', () => {
      render(
        <VizLayout width={800} height={600}>
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeInTheDocument();
    });

    it('applies width and height as inline styles on the container', () => {
      render(
        <VizLayout width={400} height={300}>
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.container)).toHaveStyle({
        width: '400px',
        height: '300px',
      });
    });

    it('calls children render prop with full width and height', () => {
      const children = jest.fn().mockReturnValue(null);
      render(
        <VizLayout width={800} height={600}>
          {children}
        </VizLayout>
      );
      expect(children).toHaveBeenCalledWith(800, 600);
    });

    it('does not render the legend testid', () => {
      render(
        <VizLayout width={800} height={600}>
          {() => null}
        </VizLayout>
      );
      expect(screen.queryByTestId(selectors.components.VizLayout.legend)).not.toBeInTheDocument();
    });
  });

  describe('with null legend', () => {
    it('renders like no-legend when legend is null', () => {
      render(
        <VizLayout width={800} height={600} legend={null}>
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.container)).toBeInTheDocument();
      expect(screen.queryByTestId(selectors.components.VizLayout.legend)).not.toBeInTheDocument();
    });
  });

  describe('with bottom legend', () => {
    const legend = (
      <VizLayout.Legend placement="bottom">
        <div>legend content</div>
      </VizLayout.Legend>
    );

    it('renders legend with correct testid', () => {
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.legend)).toBeInTheDocument();
    });

    it('sets flexDirection column on the container', () => {
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.container)).toHaveStyle({ flexDirection: 'column' });
    });

    it('applies custom maxHeight to the legend element', () => {
      render(
        <VizLayout
          width={800}
          height={600}
          legend={
            <VizLayout.Legend placement="bottom" maxHeight="20%">
              <div />
            </VizLayout.Legend>
          }
        >
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.legend)).toHaveStyle({ maxHeight: '20%' });
    });

    it('does not call children before the legend height is measured', () => {
      const children = jest.fn().mockReturnValue(null);
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {children}
        </VizLayout>
      );
      expect(children).not.toHaveBeenCalled();
    });

    it('calls children with reduced height once legend is measured', () => {
      mockUseMeasure.mockReturnValue([jest.fn(), { ...noMeasure, height: 100 }]);
      const children = jest.fn().mockReturnValue(null);
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {children}
        </VizLayout>
      );
      expect(children).toHaveBeenCalledWith(800, 500);
    });

    it('preserves full height when legend height equals container height', () => {
      mockUseMeasure.mockReturnValue([jest.fn(), { ...noMeasure, height: 600 }]);
      const children = jest.fn().mockReturnValue(null);
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {children}
        </VizLayout>
      );
      expect(children).toHaveBeenCalledWith(800, 600);
    });
  });

  describe('with right legend', () => {
    const legend = (
      <VizLayout.Legend placement="right">
        <div>legend content</div>
      </VizLayout.Legend>
    );

    it('renders legend with correct testid', () => {
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.legend)).toBeInTheDocument();
    });

    it('sets flexDirection row on the container', () => {
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.container)).toHaveStyle({ flexDirection: 'row' });
    });

    it('applies custom maxWidth to the legend element', () => {
      render(
        <VizLayout
          width={800}
          height={600}
          legend={
            <VizLayout.Legend placement="right" maxWidth="30%">
              <div />
            </VizLayout.Legend>
          }
        >
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.legend)).toHaveStyle({ maxWidth: '30%' });
    });

    it('calls children with reduced width once legend is measured', () => {
      mockUseMeasure.mockReturnValue([jest.fn(), { ...noMeasure, width: 150 }]);
      const children = jest.fn().mockReturnValue(null);
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {children}
        </VizLayout>
      );
      expect(children).toHaveBeenCalledWith(650, 600);
    });

    it('calls children with reduced width when an explicit legend width prop is set', () => {
      const children = jest.fn().mockReturnValue(null);
      render(
        <VizLayout
          width={800}
          height={600}
          legend={
            <VizLayout.Legend placement="right" width={200}>
              <div />
            </VizLayout.Legend>
          }
        >
          {children}
        </VizLayout>
      );
      expect(children).toHaveBeenCalledWith(600, 600);
    });

    it('sets the legend width style when an explicit width prop is provided', () => {
      render(
        <VizLayout
          width={800}
          height={600}
          legend={
            <VizLayout.Legend placement="right" width={200}>
              <div />
            </VizLayout.Legend>
          }
        >
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.legend)).toHaveStyle({ width: '200px' });
    });

    it('preserves full width when legend width equals container width', () => {
      mockUseMeasure.mockReturnValue([jest.fn(), { ...noMeasure, width: 800 }]);
      const children = jest.fn().mockReturnValue(null);
      render(
        <VizLayout width={800} height={600} legend={legend}>
          {children}
        </VizLayout>
      );
      expect(children).toHaveBeenCalledWith(800, 600);
    });
  });

  describe('small screen behavior', () => {
    it('forces bottom placement for a right legend when viewport is below the lg breakpoint', () => {
      Object.defineProperty(document.body, 'clientWidth', { value: 100, configurable: true });
      render(
        <VizLayout
          width={800}
          height={600}
          legend={
            <VizLayout.Legend placement="right">
              <div />
            </VizLayout.Legend>
          }
        >
          {() => null}
        </VizLayout>
      );
      expect(screen.getByTestId(selectors.components.VizLayout.container)).toHaveStyle({ flexDirection: 'column' });
    });
  });
});
