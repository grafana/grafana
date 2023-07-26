import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { LogGroup } from '../../types';

import { SelectedLogGroups } from './SelectedLogGroups';

const selectedLogGroups: LogGroup[] = [
  {
    arn: 'aws/lambda/lambda-name1',
    name: 'aws/lambda/lambda-name1',
  },
  {
    arn: 'aws/lambda/lambda-name2',
    name: 'aws/lambda/lambda-name2',
  },
];
const defaultProps = {
  selectedLogGroups,
  onChange: jest.fn(),
};

describe('SelectedLogsGroups', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });
  describe("'Show more' button", () => {
    it('should not be displayed in case 0 logs have been selected', async () => {
      render(<SelectedLogGroups {...defaultProps} selectedLogGroups={[]} />);
      await waitFor(() => expect(screen.queryByText('Show all')).not.toBeInTheDocument());
    });
    it('should not be displayed in case logs group have been selected but theyre less than 10', async () => {
      render(<SelectedLogGroups {...defaultProps} />);
      await waitFor(() => expect(screen.queryByText('Show all')).not.toBeInTheDocument());
    });
    it('should be displayed in case more than 10 log groups have been selected', async () => {
      const selectedLogGroups = Array(12).map((i) => ({
        arn: `logGroup${i}`,
        name: `logGroup${i}`,
      }));
      render(<SelectedLogGroups {...defaultProps} selectedLogGroups={selectedLogGroups} />);
      await waitFor(() => expect(screen.getByText('Show all')).toBeInTheDocument());
    });
  });

  describe("'Clear selection' button", () => {
    it('should not be displayed in case 0 logs have been selected', async () => {
      render(<SelectedLogGroups {...defaultProps} selectedLogGroups={[]} />);
      await waitFor(() => expect(screen.queryByText('Clear selection')).not.toBeInTheDocument());
    });
    it('should be displayed in case at least one log group have been selected', async () => {
      const selectedLogGroups = Array(11).map((i) => ({
        arn: `logGroup${i}`,
        name: `logGroup${i}`,
      }));
      render(<SelectedLogGroups {...defaultProps} selectedLogGroups={selectedLogGroups} />);
      await waitFor(() => expect(screen.getByText('Clear selection')).toBeInTheDocument());
    });

    it('should display confirm dialog before clearing all selections', async () => {
      const selectedLogGroups = Array(11).map((i) => ({
        arn: `logGroup${i}`,
        name: `logGroup${i}`,
      }));
      render(<SelectedLogGroups {...defaultProps} selectedLogGroups={selectedLogGroups} />);
      await waitFor(() => userEvent.click(screen.getByText('Clear selection')));
      await waitFor(() =>
        expect(screen.getByText('Are you sure you want to clear all log groups?')).toBeInTheDocument()
      );
      await waitFor(() => userEvent.click(screen.getByRole('button', { name: 'Yes' })));
      expect(defaultProps.onChange).toHaveBeenCalledWith([]);
    });
  });

  describe("'Clear selection' button", () => {
    it('should not be displayed in case 0 logs have been selected', async () => {
      render(<SelectedLogGroups {...defaultProps} selectedLogGroups={[]} />);
      await waitFor(() => expect(screen.queryByText('Clear selection')).not.toBeInTheDocument());
    });
    it('should be displayed in case at least one log group have been selected', async () => {
      const selectedLogGroups = Array(11).map((i) => ({
        arn: `logGroup${i}`,
        name: `logGroup${i}`,
      }));
      render(<SelectedLogGroups {...defaultProps} selectedLogGroups={selectedLogGroups} />);
      await waitFor(() => expect(screen.getByText('Clear selection')).toBeInTheDocument());
    });
  });
});
