import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ContainerSelect } from './ContainerSelect';

type Opt = { label: string; value: string };
type LoadOptions = () => Promise<Opt[]>;

interface StackProps {
  children: React.ReactNode;
}

interface AsyncSelectProps {
  options: Opt[];
  value: Opt | null;
  onChange: (value: Opt | null) => void;
  isLoading?: boolean;
}

jest.mock('@grafana/ui', () => {
  return {
    Stack: ({ children }: StackProps) => <div>{children}</div>,

    AsyncSelect: ({ options, value, onChange, isLoading }: AsyncSelectProps) => (
      <div>
        {isLoading && <div data-testid="loading">loading</div>}

        <select
          data-testid="container-select"
          value={value?.value ?? ''}
          onChange={(e) => {
            const selectedOption = options.find((o: Opt) => o.value === e.target.value) ?? null;
            onChange(selectedOption);
          }}
        >
          <option value="">--</option>
          {options.map((o: Opt) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    ),
  };
});

describe('ContainerSelect', () => {
  it('loads options on mount', async () => {
    const loadOptions: jest.MockedFunction<LoadOptions> = jest.fn().mockResolvedValue([
      { label: 'container-1', value: 'c1' },
      { label: 'container-2', value: 'c2' },
    ]);

    await act(async () => {
      render(<ContainerSelect value={undefined} onChange={jest.fn()} loadOptions={loadOptions} />);
    });

    expect(loadOptions).toHaveBeenCalledTimes(1);

    await waitFor(() => {
      expect(screen.getByText('container-1')).toBeInTheDocument();
      expect(screen.getByText('container-2')).toBeInTheDocument();
    });
  });

  it('shows loading state initially', async () => {
    let resolveFn: (value: Opt[]) => void = () => {};

    const loadOptions: jest.Mock<Promise<Opt[]>, []> = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFn = resolve;
        })
    );

    await act(async () => {
      render(<ContainerSelect value={undefined} onChange={jest.fn()} loadOptions={loadOptions} />);
    });

    expect(screen.getByTestId('loading')).toBeInTheDocument();

    await act(async () => {
      resolveFn([{ label: 'c1', value: 'c1' }]);
    });

    await waitFor(() => {
      expect(screen.queryByTestId('loading')).not.toBeInTheDocument();
    });
  });

  it('calls onChange when selection changes', async () => {
    const user = userEvent.setup();

    const loadOptions: jest.MockedFunction<LoadOptions> = jest
      .fn()
      .mockResolvedValue([{ label: 'container-1', value: 'c1' }]);

    const onChange = jest.fn();

    await act(async () => {
      render(<ContainerSelect value={undefined} onChange={onChange} loadOptions={loadOptions} />);
    });

    const select = screen.getByTestId('container-select');

    await user.selectOptions(select, 'c1');

    expect(onChange).toHaveBeenCalledWith('c1');
  });

  it('renders selected value', async () => {
    const loadOptions: jest.MockedFunction<LoadOptions> = jest
      .fn()
      .mockResolvedValue([{ label: 'container-1', value: 'c1' }]);

    await act(async () => {
      render(<ContainerSelect value="c1" onChange={jest.fn()} loadOptions={loadOptions} />);
    });

    const select = screen.getByTestId('container-select');

    expect((select as HTMLSelectElement).value).toBe('c1');
  });
});
