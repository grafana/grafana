import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ChangeCheckIntervalModal } from './ChangeCheckIntervalModal';
import { CheckDetails } from 'app/percona/check/types';

jest.mock('../../../Check.service');
jest.mock('app/core/app_events', () => {
  return {
    appEvents: {
      emit: jest.fn(),
    },
  };
});

const TEST_CHECK: CheckDetails = {
  summary: 'Test',
  name: 'test',
  interval: 'STANDARD',
  description: 'test description',
  disabled: false,
};

describe('ChangeCheckIntervalModal', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render modal', () => {
    render(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={jest.fn()} isVisible />);

    expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('change-check-interval-form')).toBeInTheDocument();
    expect(screen.getByTestId('change-check-interval-radio-group-wrapper')).toBeInTheDocument();
  });

  it('does not render the modal when visible is set to false', () => {
    render(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={jest.fn()} isVisible={false} />);
    expect(screen.queryByTestId('change-check-interval-form')).not.toBeInTheDocument();
  });

  it('renders the modal when visible is set to true', () => {
    render(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={jest.fn()} isVisible />);
    expect(screen.getByTestId('change-check-interval-form')).toBeInTheDocument();
  });

  it('should call setVisible on close', () => {
    const setVisible = jest.fn();

    render(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={setVisible} isVisible />);

    const modalBackground = screen.getByTestId('modal-background');
    fireEvent.click(modalBackground);
    expect(setVisible).toHaveBeenCalledTimes(1);
  });

  it('should call setVisible and getAlertRuleTemplates on submit', async () => {
    const setVisible = jest.fn();

    render(<ChangeCheckIntervalModal check={TEST_CHECK} setVisible={setVisible} isVisible />);

    const form = screen.getByTestId('change-check-interval-form');
    fireEvent.submit(form);
    await waitFor(() => expect(setVisible).toHaveBeenCalledWith(false));
  });
});
