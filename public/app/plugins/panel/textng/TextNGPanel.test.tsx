import { render, screen } from '@testing-library/react';

import { type DataFrame, toDataFrame } from '@grafana/data';

import { getPanelProps } from '../test-utils';

import { TextNGPanel } from './TextNGPanel';

function buildProps(series?: DataFrame[]) {
  const props = getPanelProps(undefined);
  if (series) {
    props.data = { ...props.data, series };
  }
  return props;
}

function renderTextNGPanel(series?: DataFrame[]) {
  return render(<TextNGPanel {...buildProps(series)} />);
}

describe('TextNGPanel', () => {
  it('renders the panel container', () => {
    renderTextNGPanel();

    expect(screen.getByTestId('TextNGPanel')).toBeInTheDocument();
  });

  it('renders the placeholder text', () => {
    renderTextNGPanel();

    expect(screen.getByText(/New text panel/)).toBeInTheDocument();
  });

  it('shows a series count of 0 when there is no data', () => {
    renderTextNGPanel([]);

    expect(screen.getByTestId('TextNGPanel')).toHaveTextContent('New text panel (0)');
  });

  it('shows the number of series in the data', () => {
    renderTextNGPanel([
      toDataFrame({ fields: [{ name: 'A', values: [1] }] }),
      toDataFrame({ fields: [{ name: 'B', values: [2] }] }),
      toDataFrame({ fields: [{ name: 'C', values: [3] }] }),
    ]);

    expect(screen.getByTestId('TextNGPanel')).toHaveTextContent('New text panel (3)');
  });

  it('updates the series count when data changes', () => {
    const { rerender } = renderTextNGPanel([toDataFrame({ fields: [] })]);

    expect(screen.getByTestId('TextNGPanel')).toHaveTextContent('New text panel (1)');

    rerender(<TextNGPanel {...buildProps([toDataFrame({ fields: [] }), toDataFrame({ fields: [] })])} />);

    expect(screen.getByTestId('TextNGPanel')).toHaveTextContent('New text panel (2)');
  });
});
