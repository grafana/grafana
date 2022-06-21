import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { QueryOperationAction, QueryOperationActionProps } from './QueryOperationAction';

const setup = (propOverrides?: Partial<QueryOperationActionProps>) => {
  const props: QueryOperationActionProps = {
    icon: 'panel-add',
    title: 'test',
    onClick: jest.fn(),
    disabled: false,
  };

  Object.assign(props, propOverrides);

  render(<QueryOperationAction {...props} />);
};

describe('QueryOperationAction tests', () => {
  it('should render component', () => {
    setup();

    expect(
      screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') })
    ).toBeInTheDocument();
  });

  it('should call on click handler', () => {
    const clickSpy = jest.fn();
    setup({ disabled: false, onClick: clickSpy });

    expect(clickSpy).not.toHaveBeenCalled();
    const queryButton = screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') });

    fireEvent.click(queryButton);

    expect(clickSpy).toHaveBeenCalled();
  });

  it('should not call on click handler when disabled', () => {
    const clickSpy = jest.fn();
    setup({ disabled: true, onClick: clickSpy });

    expect(clickSpy).not.toHaveBeenCalled();
    const queryButton = screen.getByRole('button', { name: selectors.components.QueryEditorRow.actionButton('test') });

    fireEvent.click(queryButton);

    expect(clickSpy).not.toHaveBeenCalled();
  });
});
