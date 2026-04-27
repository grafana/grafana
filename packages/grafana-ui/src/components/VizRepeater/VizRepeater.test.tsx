import { render, screen } from '@testing-library/react';

import { VizOrientation } from '@grafana/data/types';

import { VizRepeater, type VizRepeaterRenderValueProps } from './VizRepeater';

type Value = { label: string };

const makeValues = (labels: string[]) => labels.map((label) => ({ label }));

const makeRepeatedViz = () =>
  jest.fn(({ value }: VizRepeaterRenderValueProps<Value>) => <div data-testid={`item-${value.label}`} />);

const defaultProps = {
  width: 300,
  height: 200,
  source: 'source',
  renderCounter: 0,
  orientation: VizOrientation.Horizontal,
  getValues: () => makeValues(['A', 'B', 'C']),
  itemSpacing: 8,
};

describe('VizRepeater', () => {
  describe('initial rendering', () => {
    it('renders one item per value returned by getValues', () => {
      render(<VizRepeater {...defaultProps} renderValue={makeRepeatedViz()} />);
      expect(screen.getByTestId('item-A')).toBeInTheDocument();
      expect(screen.getByTestId('item-B')).toBeInTheDocument();
      expect(screen.getByTestId('item-C')).toBeInTheDocument();
    });

    it('calls getValues exactly once on mount', () => {
      const getValues = jest.fn(() => makeValues(['A']));
      render(<VizRepeater {...defaultProps} getValues={getValues} renderValue={makeRepeatedViz()} />);
      expect(getValues).toHaveBeenCalledTimes(1);
    });

    it('passes count equal to total values to every renderValue call', () => {
      const repeatedViz = makeRepeatedViz();
      render(<VizRepeater {...defaultProps} renderValue={repeatedViz} />);
      repeatedViz.mock.calls.forEach(([props]) => expect(props.count).toBe(3));
    });
  });

  describe('orientation resolution', () => {
    it('uses flexDirection column for Horizontal', () => {
      const { container } = render(
        <VizRepeater {...defaultProps} orientation={VizOrientation.Horizontal} renderValue={makeRepeatedViz()} />
      );
      expect(container.firstChild).toHaveStyle({ flexDirection: 'column' });
    });

    it('uses flexDirection row for Vertical', () => {
      const { container } = render(
        <VizRepeater {...defaultProps} orientation={VizOrientation.Vertical} renderValue={makeRepeatedViz()} />
      );
      expect(container.firstChild).toHaveStyle({ flexDirection: 'row' });
    });

    it('resolves Auto to Vertical when width > height', () => {
      const { container } = render(
        <VizRepeater
          {...defaultProps}
          width={400}
          height={200}
          orientation={VizOrientation.Auto}
          renderValue={makeRepeatedViz()}
        />
      );
      expect(container.firstChild).toHaveStyle({ flexDirection: 'row' });
    });

    it('resolves Auto to Horizontal when width <= height', () => {
      const { container } = render(
        <VizRepeater
          {...defaultProps}
          width={200}
          height={400}
          orientation={VizOrientation.Auto}
          renderValue={makeRepeatedViz()}
        />
      );
      expect(container.firstChild).toHaveStyle({ flexDirection: 'column' });
    });

    it('passes the resolved orientation to each renderValue call', () => {
      const repeatedViz = makeRepeatedViz();
      render(
        <VizRepeater
          {...defaultProps}
          width={400}
          height={200}
          orientation={VizOrientation.Auto}
          renderValue={repeatedViz}
        />
      );
      repeatedViz.mock.calls.forEach(([props]) => expect(props.orientation).toBe(VizOrientation.Vertical));
    });
  });

  describe('width and height distribution', () => {
    it('gives each item the full width in Horizontal orientation', () => {
      const repeatedViz = makeRepeatedViz();
      render(
        <VizRepeater {...defaultProps} width={300} orientation={VizOrientation.Horizontal} renderValue={repeatedViz} />
      );
      expect(repeatedViz.mock.calls[0][0].width).toBe(300);
    });

    it('distributes height evenly across items in Horizontal orientation', () => {
      const repeatedViz = makeRepeatedViz();
      const height = 300;
      const itemSpacing = 8;
      const count = 3;
      render(
        <VizRepeater
          {...defaultProps}
          height={height}
          itemSpacing={itemSpacing}
          getValues={() => makeValues(['A', 'B', 'C'])}
          orientation={VizOrientation.Horizontal}
          renderValue={repeatedViz}
        />
      );
      const expectedHeight = (height + itemSpacing) / count - itemSpacing;
      expect(repeatedViz.mock.calls[0][0].height).toBeCloseTo(expectedHeight);
    });

    it('gives each item the full height in Vertical orientation', () => {
      const repeatedViz = makeRepeatedViz();
      render(
        <VizRepeater {...defaultProps} height={200} orientation={VizOrientation.Vertical} renderValue={repeatedViz} />
      );
      expect(repeatedViz.mock.calls[0][0].height).toBe(200);
    });

    it('distributes width evenly across items in Vertical orientation', () => {
      const repeatedViz = makeRepeatedViz();
      const width = 300;
      const itemSpacing = 8;
      const count = 3;
      render(
        <VizRepeater
          {...defaultProps}
          width={width}
          itemSpacing={itemSpacing}
          getValues={() => makeValues(['A', 'B', 'C'])}
          orientation={VizOrientation.Vertical}
          renderValue={repeatedViz}
        />
      );
      const expectedWidth = width / count - itemSpacing + itemSpacing / count;
      expect(repeatedViz.mock.calls[0][0].width).toBeCloseTo(expectedWidth);
    });
  });

  describe('updates via componentDidUpdate', () => {
    it('re-fetches values when source prop changes', () => {
      const getValues = jest.fn(() => makeValues(['A']));
      const { rerender } = render(
        <VizRepeater {...defaultProps} source="v1" getValues={getValues} renderValue={makeRepeatedViz()} />
      );
      rerender(<VizRepeater {...defaultProps} source="v2" getValues={getValues} renderValue={makeRepeatedViz()} />);
      expect(getValues).toHaveBeenCalledTimes(2);
    });

    it('re-fetches values when renderCounter prop changes', () => {
      const getValues = jest.fn(() => makeValues(['A']));
      const { rerender } = render(
        <VizRepeater {...defaultProps} renderCounter={0} getValues={getValues} renderValue={makeRepeatedViz()} />
      );
      rerender(
        <VizRepeater {...defaultProps} renderCounter={1} getValues={getValues} renderValue={makeRepeatedViz()} />
      );
      expect(getValues).toHaveBeenCalledTimes(2);
    });

    it('does not re-fetch values when unrelated props change', () => {
      const getValues = jest.fn(() => makeValues(['A']));
      const { rerender } = render(
        <VizRepeater {...defaultProps} width={300} getValues={getValues} renderValue={makeRepeatedViz()} />
      );
      rerender(<VizRepeater {...defaultProps} width={500} getValues={getValues} renderValue={makeRepeatedViz()} />);
      expect(getValues).toHaveBeenCalledTimes(1);
    });

    it('displays new values after source changes', () => {
      const repeatedViz = makeRepeatedViz();
      const { rerender } = render(
        <VizRepeater {...defaultProps} source="s1" getValues={() => makeValues(['Old'])} renderValue={repeatedViz} />
      );
      expect(screen.getByTestId('item-Old')).toBeInTheDocument();
      rerender(
        <VizRepeater {...defaultProps} source="s2" getValues={() => makeValues(['New'])} renderValue={repeatedViz} />
      );
      expect(screen.queryByTestId('item-Old')).not.toBeInTheDocument();
      expect(screen.getByTestId('item-New')).toBeInTheDocument();
    });
  });

  describe('alignment factors', () => {
    it('calls getAlignmentFactors with values and item dimensions', () => {
      const getAlignmentFactors = jest.fn(() => ({}));
      render(
        <VizRepeater
          {...defaultProps}
          width={300}
          height={200}
          orientation={VizOrientation.Horizontal}
          getAlignmentFactors={getAlignmentFactors}
          renderValue={makeRepeatedViz()}
        />
      );
      expect(getAlignmentFactors).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ label: 'A' })]),
        300,
        expect.any(Number)
      );
    });

    it('passes alignment factors result to every renderValue call', () => {
      const factors = { baseline: 42 };
      const repeatedViz = makeRepeatedViz();
      render(<VizRepeater {...defaultProps} getAlignmentFactors={() => factors} renderValue={repeatedViz} />);
      repeatedViz.mock.calls.forEach(([props]) => expect(props.alignmentFactors).toBe(factors));
    });

    it('passes an empty object as alignmentFactors when getAlignmentFactors is not provided', () => {
      const repeatedViz = makeRepeatedViz();
      render(<VizRepeater {...defaultProps} renderValue={repeatedViz} />);
      repeatedViz.mock.calls.forEach(([props]) => expect(props.alignmentFactors).toEqual({}));
    });
  });

  describe('item margin management', () => {
    describe.each([
      [VizOrientation.Horizontal, 'marginBottom'],
      [VizOrientation.Vertical, 'marginRight'],
    ])('when orientation is %s', (orientation, marginProperty) => {
      it(`applies ${marginProperty} to non-last items`, () => {
        const { container } = render(
          <VizRepeater {...defaultProps} itemSpacing={10} orientation={orientation} renderValue={makeRepeatedViz()} />
        );
        const outerDiv = container.firstChild as HTMLElement;
        const firstItem = outerDiv.children[0] as HTMLElement;
        expect(firstItem).toHaveStyle({ [marginProperty]: '10px' });
      });

      it(`removes ${marginProperty} from the last item`, () => {
        const { container } = render(
          <VizRepeater {...defaultProps} itemSpacing={10} orientation={orientation} renderValue={makeRepeatedViz()} />
        );
        const outerDiv = container.firstChild as HTMLElement;
        const lastItem = outerDiv.children[outerDiv.children.length - 1] as HTMLElement;
        expect(lastItem).toHaveStyle({ [marginProperty]: '0px' });
      });
    });
  });

  describe('overflow scrolling', () => {
    it('sets overflowX auto in Vertical orientation when minVizWidth is provided', () => {
      const { container } = render(
        <VizRepeater
          {...defaultProps}
          orientation={VizOrientation.Vertical}
          minVizWidth={200}
          renderValue={makeRepeatedViz()}
        />
      );
      expect(container.firstChild).toHaveStyle({ overflowX: 'auto' });
    });

    it('sets overflowY auto in Horizontal orientation when minVizHeight is provided', () => {
      const { container } = render(
        <VizRepeater
          {...defaultProps}
          orientation={VizOrientation.Horizontal}
          minVizHeight={50}
          renderValue={makeRepeatedViz()}
        />
      );
      expect(container.firstChild).toHaveStyle({ overflowY: 'auto' });
    });
  });

  describe('vizHeight clamping (minVizHeight / maxVizHeight)', () => {
    it('clamps vizHeight up to minVizHeight when items would otherwise be too small', () => {
      const repeatedViz = makeRepeatedViz();
      render(
        <VizRepeater
          {...defaultProps}
          height={100}
          itemSpacing={8}
          getValues={() => makeValues(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'])}
          orientation={VizOrientation.Horizontal}
          minVizHeight={20}
          maxVizHeight={200}
          renderValue={repeatedViz}
        />
      );
      repeatedViz.mock.calls.forEach(([props]) => expect(props.height).toBeGreaterThanOrEqual(20));
    });

    it('clamps vizHeight down to maxVizHeight when a single item would be too tall', () => {
      const repeatedViz = makeRepeatedViz();
      render(
        <VizRepeater
          {...defaultProps}
          height={500}
          getValues={() => makeValues(['A'])}
          orientation={VizOrientation.Horizontal}
          maxVizHeight={100}
          renderValue={repeatedViz}
        />
      );
      expect(repeatedViz.mock.calls[0][0].height).toBeLessThanOrEqual(100);
    });
  });

  describe('autoGrid layout', () => {
    it('renders the correct number of items in autoGrid mode', () => {
      const repeatedViz = makeRepeatedViz();
      render(<VizRepeater {...defaultProps} autoGrid orientation={VizOrientation.Auto} renderValue={repeatedViz} />);
      expect(repeatedViz).toHaveBeenCalledTimes(3);
    });

    it('falls back to flex layout when autoGrid is set but orientation is not Auto', () => {
      const { container } = render(
        <VizRepeater
          {...defaultProps}
          autoGrid
          orientation={VizOrientation.Horizontal}
          renderValue={makeRepeatedViz()}
        />
      );
      expect(container.firstChild).toHaveStyle({ display: 'flex' });
    });
  });
});
