import { render, screen } from '@testing-library/react';

import { BulkActionProgress, ProgressState } from './BulkActionProgress';

const setup = (progressOverrides: Partial<ProgressState> = {}) => {
  const defaultProgress: ProgressState = {
    current: 5,
    total: 10,
    item: 'Test Dashboard',
    ...progressOverrides,
  };

  const props = {
    progress: defaultProgress,
  };

  return {
    ...render(<BulkActionProgress {...props} />),
    props,
  };
};

describe('BulkActionProgress', () => {
  it('should render progress text with current and total values', () => {
    setup({ current: 3, total: 8 });

    expect(screen.getByText(/Progress: 3 of 8/)).toBeInTheDocument();
  });

  it('should render spinning icon', () => {
    setup();

    const spinnerIcon = screen.getByRole('img', { hidden: true });
    expect(spinnerIcon).toBeInTheDocument();
    expect(spinnerIcon).toHaveClass('fa-spin');
  });

  it('should render current item being deleted', () => {
    setup({ item: 'My Test Dashboard' });

    expect(screen.getByText(/Deleting:/)).toBeInTheDocument();
    expect(screen.getByText('My Test Dashboard')).toBeInTheDocument();
  });

  it('should calculate and display correct progress percentage at 0%', () => {
    setup({ current: 0, total: 10 });

    // ProgressBar component should receive 0% progress
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('should calculate and display correct progress percentage at 50%', () => {
    setup({ current: 5, total: 10 });

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('should calculate and display correct progress percentage at 100%', () => {
    setup({ current: 10, total: 10 });

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeInTheDocument();
  });

  it('should handle edge case with total of 1', () => {
    setup({ current: 1, total: 1 });

    expect(screen.getByText(/Progress: 1 of 1/)).toBeInTheDocument();
  });

  it('should handle edge case with zero current progress', () => {
    setup({ current: 0, total: 5 });

    expect(screen.getByText(/Progress: 0 of 5/)).toBeInTheDocument();
  });

  it('should render all required elements together', () => {
    setup({ current: 7, total: 15, item: 'Complex Dashboard Name' });

    // Progress text
    expect(screen.getByText(/Progress: 7 of 15/)).toBeInTheDocument();

    // Spinner icon
    expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();

    // Progress bar
    expect(screen.getByRole('progressbar')).toBeInTheDocument();

    // Current item text
    expect(screen.getByText(/Deleting:/)).toBeInTheDocument();
    expect(screen.getByText('Complex Dashboard Name')).toBeInTheDocument();
  });
});
