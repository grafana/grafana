import React from 'react';
import { render, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ManualEntryEditor } from './ManualEntryEditor';
import { Props } from '../../../../features/search/components/DashboardSearch';
import { defaultQuery } from '../constants';

beforeEach(() => {
  jest.clearAllMocks();
});

const mockOnChange = jest.fn();
const setup = (testProps?: Partial<Props>) => {
  const props = {
    onRunQuery: jest.fn(),
    query: defaultQuery,
    onChange: mockOnChange,
    ...testProps,
  };

  render(<ManualEntryEditor {...props} />);
};

describe('ManualEntryEditor', () => {
  it('should render', () => {
    setup();

    expect(screen.getByLabelText(/New value/i)).toBeInTheDocument();
  });
});
