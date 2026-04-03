import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { SplashScreenNav } from './SplashScreenNav';

const defaultProps = {
  activeIndex: 0,
  total: 4,
  onPrev: jest.fn(),
  onNext: jest.fn(),
  onGoTo: jest.fn(),
};

function renderNav(overrides: Partial<typeof defaultProps> = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<SplashScreenNav {...props} />);
}

describe('SplashScreenNav', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correct number of dot buttons matching total', () => {
    renderNav({ total: 4 });

    expect(screen.getAllByLabelText(/Go to slide/)).toHaveLength(4);
  });

  it('marks the active dot with aria-current', () => {
    renderNav({ activeIndex: 2, total: 4 });

    const dots = screen.getAllByLabelText(/Go to slide/);
    expect(dots[0]).not.toHaveAttribute('aria-current');
    expect(dots[2]).toHaveAttribute('aria-current', 'step');
  });

  it('calls onGoTo with correct index when a dot is clicked', async () => {
    const onGoTo = jest.fn();
    renderNav({ onGoTo, total: 4 });

    await userEvent.click(screen.getAllByLabelText(/Go to slide/)[2]);
    expect(onGoTo).toHaveBeenCalledWith(2);
  });

  it('calls navigation callbacks when prev/next buttons are clicked', async () => {
    const onPrev = jest.fn();
    const onNext = jest.fn();
    renderNav({ onPrev, onNext });

    await userEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(onPrev).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('displays correct counter text', () => {
    renderNav({ activeIndex: 0, total: 4 });

    expect(screen.getByText('1/4')).toBeInTheDocument();
  });
});
