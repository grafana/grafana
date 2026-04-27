import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback, useRef, useState, type ReactElement } from 'react';

import { ReducerID } from '@grafana/data/transformations';

import { Field } from '../Forms/Field';

import { StatsPicker } from './StatsPicker';
import { pickComboboxLayout } from './pickComboboxLayout';

/** Needed for Combobox virtual list. Clone of `public/test/helpers/comboboxTestSetup` (avoid cross-package import). */
const comboboxTestSetup = () => {
  const mockGetBoundingClientRect = jest.fn(() => ({
    width: 120,
    height: 120,
    top: 0,
    left: 0,
    bottom: 0,
    right: 0,
  }));

  Object.defineProperty(Element.prototype, 'getBoundingClientRect', {
    value: mockGetBoundingClientRect,
  });
};

describe('pickComboboxLayout', () => {
  it('returns auto layout with default minWidth 8 when minWidth is omitted', () => {
    expect(pickComboboxLayout('auto', undefined, undefined)).toEqual({
      width: 'auto',
      minWidth: 8,
      maxWidth: undefined,
    });
  });

  it('returns auto layout with the given minWidth and maxWidth', () => {
    expect(pickComboboxLayout('auto', 12, 320)).toEqual({
      width: 'auto',
      minWidth: 12,
      maxWidth: 320,
    });
  });

  it('returns only numeric width when width is a number (ignores minWidth and maxWidth)', () => {
    expect(pickComboboxLayout(40, 8, 200)).toEqual({ width: 40 });
  });

  it('returns undefined width when width is omitted (ignores minWidth and maxWidth)', () => {
    expect(pickComboboxLayout(undefined, 16, 400)).toEqual({ width: undefined });
  });
});

const TEST_INPUT_ID = 'stats-picker-test-input';
const TEST_INPUT_TESTID = 'stats-picker-test-input';

describe('StatsPicker', () => {
  let user: ReturnType<typeof userEvent.setup>;

  beforeAll(() => {
    comboboxTestSetup();
  });

  beforeEach(() => {
    user = userEvent.setup({ applyAccept: false });
    jest.clearAllMocks();
  });

  const renderWithField = (picker: ReactElement<{}>) =>
    render(
      <Field label="Stats" htmlFor={TEST_INPUT_ID}>
        {picker}
      </Field>
    );

  it('renders a combobox and shows the label for the selected stat', () => {
    renderWithField(
      <StatsPicker id={TEST_INPUT_ID} data-testid={TEST_INPUT_TESTID} stats={[ReducerID.sum]} onChange={jest.fn()} />
    );
    expect(screen.getByRole('combobox', { name: 'Stats' })).toBeInTheDocument();
    expect(screen.getByDisplayValue('Total')).toBeInTheDocument();
  });

  it('applies the id prop to the combobox input', () => {
    render(<StatsPicker stats={[ReducerID.sum]} onChange={jest.fn()} id="stats-picker-by-id" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'stats-picker-by-id');
  });

  it('applies id to the MultiCombobox input', () => {
    render(<StatsPicker stats={[ReducerID.sum]} onChange={jest.fn()} allowMultiple id="multi-stats-input" />);
    expect(screen.getByRole('combobox')).toHaveAttribute('id', 'multi-stats-input');
  });

  it('associates Field label with the input via htmlFor and id', async () => {
    renderWithField(<StatsPicker id={TEST_INPUT_ID} stats={[ReducerID.sum]} onChange={jest.fn()} />);

    expect(screen.getByRole('combobox')).toHaveAttribute('id', TEST_INPUT_ID);
    await user.click(screen.getByText('Stats'));
    expect(screen.getByRole('combobox')).toHaveFocus();
  });

  it('calls onChange with only known stats when the list contains unknown ids', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = jest.fn();

    render(<StatsPicker stats={['not-a-real-reducer', ReducerID.sum]} onChange={onChange} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([ReducerID.sum]);
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('calls onChange with the first stat when multiple are passed and allowMultiple is false', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const onChange = jest.fn();

    render(<StatsPicker stats={[ReducerID.sum, ReducerID.mean]} onChange={onChange} allowMultiple={false} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([ReducerID.sum]);
    });
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('calls onChange with defaultStat when stats is empty', async () => {
    const onChange = jest.fn();

    render(<StatsPicker stats={[]} onChange={onChange} defaultStat={ReducerID.last} />);

    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith([ReducerID.last]);
    });
  });

  it('renders MultiCombobox when allowMultiple is true', () => {
    render(
      <StatsPicker
        id={TEST_INPUT_ID}
        data-testid={TEST_INPUT_TESTID}
        stats={[ReducerID.sum]}
        onChange={jest.fn()}
        allowMultiple
      />
    );
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove Total' })).toBeInTheDocument();
  });

  it('renders Combobox when allowMultiple is false', () => {
    render(<StatsPicker stats={[ReducerID.sum]} onChange={jest.fn()} />);
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Total' })).not.toBeInTheDocument();
  });

  it('passes only filterOptions-matching stats as combobox options', async () => {
    render(
      <StatsPicker
        stats={[ReducerID.sum]}
        onChange={jest.fn()}
        filterOptions={(ext) => ext.id === ReducerID.sum}
        data-testid={TEST_INPUT_TESTID}
      />
    );

    await user.click(screen.getByTestId(TEST_INPUT_TESTID));

    await waitFor(() => {
      expect(document.querySelector('#combobox-option-sum')).toBeInTheDocument();
    });
    expect(document.querySelector('#combobox-option-mean')).not.toBeInTheDocument();
  });

  it('shows the clear control when defaultStat is omitted and a value is selected', () => {
    render(<StatsPicker stats={[ReducerID.sum]} onChange={jest.fn()} data-testid={TEST_INPUT_TESTID} />);
    expect(screen.getByTitle('Clear value')).toBeInTheDocument();
  });

  it('hides the clear control when defaultStat is provided', () => {
    render(
      <StatsPicker
        stats={[ReducerID.sum]}
        onChange={jest.fn()}
        defaultStat={ReducerID.last}
        data-testid={TEST_INPUT_TESTID}
      />
    );
    expect(screen.queryByTitle('Clear value')).not.toBeInTheDocument();
  });

  it('forwards combobox selection to onChange as a single-element array', async () => {
    const onChange = jest.fn();
    const sumOrMean = (ext: { id: string }) => ext.id === ReducerID.sum || ext.id === ReducerID.mean;

    const Controlled = () => {
      const [stats, setStats] = useState<string[]>([ReducerID.sum]);
      const onChangeRef = useRef(onChange);
      onChangeRef.current = onChange;
      const handleChange = useCallback((next: string[]) => {
        onChangeRef.current(next);
        setStats(next);
      }, []);

      return (
        <StatsPicker
          id={TEST_INPUT_ID}
          data-testid={TEST_INPUT_TESTID}
          stats={stats}
          onChange={handleChange}
          filterOptions={sumOrMean}
        />
      );
    };

    renderWithField(<Controlled />);

    await user.click(screen.getByRole('combobox', { name: 'Stats' }));

    await waitFor(() => {
      expect(document.getElementById('combobox-option-mean')).toBeInTheDocument();
    });

    await user.click(document.getElementById('combobox-option-mean')!);

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith([ReducerID.mean]);
    });
    expect(screen.getByDisplayValue('Mean')).toBeInTheDocument();
  });

  it('maps a cleared combobox value to an empty stats array', async () => {
    const onChange = jest.fn();

    const Controlled = () => {
      const [stats, setStats] = useState<string[]>([ReducerID.sum]);
      const onChangeRef = useRef(onChange);
      onChangeRef.current = onChange;
      const handleChange = useCallback((next: string[]) => {
        onChangeRef.current(next);
        setStats(next);
      }, []);

      return <StatsPicker id={TEST_INPUT_ID} data-testid={TEST_INPUT_TESTID} stats={stats} onChange={handleChange} />;
    };

    renderWithField(<Controlled />);

    await user.click(screen.getByTitle('Clear value'));

    await waitFor(() => {
      expect(onChange).toHaveBeenLastCalledWith([]);
    });
  });
});
