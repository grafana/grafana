import React from 'react';
import { AlertRuleTemplate } from './AlertRuleTemplate';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AlertRuleTemplateService } from './AlertRuleTemplate.service';
import { Overlay } from '../../../shared/components/Elements/Overlay/Overlay';

jest.mock('./AlertRuleTemplate.service');
jest.mock('@percona/platform-core', () => {
  const originalModule = jest.requireActual('@percona/platform-core');
  return {
    ...originalModule,
    logger: {
      error: jest.fn(),
    },
  };
});
jest.mock('../../../shared/components/Elements/Overlay/Overlay', () => ({
  Overlay: jest.fn(({ children }) => <div>{children}</div>),
}));

describe('AlertRuleTemplate', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should render add modal', async () => {
    await waitFor(() => render(<AlertRuleTemplate />));

    expect(screen.queryByTestId('modal-wrapper')).not.toBeInTheDocument();
    const button = screen.getByTestId('alert-rule-template-add-modal-button');
    fireEvent.click(button);
    expect(screen.getByTestId('modal-wrapper')).toBeInTheDocument();
  });

  it('should render table content', async () => {
    await waitFor(() => render(<AlertRuleTemplate />));

    expect(screen.getByTestId('table-thead').querySelectorAll('tr')).toHaveLength(1);
    expect(screen.getByTestId('table-tbody').querySelectorAll('tr')).toHaveLength(5);
    expect(screen.queryByTestId('table-no-data')).not.toBeInTheDocument();
  });

  it('should render correctly without data', async () => {
    jest.spyOn(AlertRuleTemplateService, 'list').mockImplementation(() => {
      throw Error('test error');
    });

    render(<AlertRuleTemplate />);

    expect(screen.queryByTestId('table-thead')).not.toBeInTheDocument();
    expect(screen.queryByTestId('table-tbody')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
  });

  it('should have table initially loading', async () => {
    render(<AlertRuleTemplate />);

    expect(Overlay).toHaveBeenNthCalledWith(1, expect.objectContaining({ isPending: true }), expect.anything());

    expect(Overlay).toHaveBeenNthCalledWith(2, expect.objectContaining({ isPending: false }), expect.anything());
    expect(screen.getByTestId('table-no-data')).toBeInTheDocument();
  });
});
