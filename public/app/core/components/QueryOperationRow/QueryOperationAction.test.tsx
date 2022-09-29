import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { QueryOperationAction, QueryOperationActionProps } from './QueryOperationAction';

const setup = (propOverrides?: Partial<QueryOperationActionProps>) => {
  const props: QueryOperationActionProps = {
    icon: 'panel-add',
    title: 'test',
    onClick: jest.fn(),
    disabled: false,
    ...propOverrides,
  };

  render(<QueryOperationAction {...props} />);
};

describe('QueryOperationAction tests', () => {
  it('should render component', () => {
    setup();

    expect(
      screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') })
    ).toBeInTheDocument();
  });

  it('should call on click handler', async () => {
    const clickSpy = jest.fn();
    setup({ disabled: false, onClick: clickSpy });

    expect(clickSpy).not.toHaveBeenCalled();
    const queryButton = screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') });

    await userEvent.click(queryButton);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('should not call on click handler when disabled', async () => {
    const clickSpy = jest.fn();
    setup({ disabled: true, onClick: clickSpy });

    expect(clickSpy).not.toHaveBeenCalled();
    const queryButton = screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') });

    await userEvent.click(queryButton);

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
