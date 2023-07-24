import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React, { ComponentPropsWithoutRef } from 'react';

import { selectors } from '@grafana/e2e-selectors';

import { QueryOperationAction, QueryOperationToggleAction } from './QueryOperationAction';

describe('QueryOperationAction tests', () => {
  function setup(propOverrides?: Partial<ComponentPropsWithoutRef<typeof QueryOperationAction>>) {
    const props: ComponentPropsWithoutRef<typeof QueryOperationAction> = {
      icon: 'panel-add',
      title: 'test',
      onClick: jest.fn(),
      disabled: false,
      ...propOverrides,
    };

    render(<QueryOperationAction {...props} />);
  }

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

describe('QueryOperationToggleAction', () => {
  function setup(active: boolean) {
    const props: ComponentPropsWithoutRef<typeof QueryOperationToggleAction> = {
      icon: 'panel-add',
      title: 'test',
      onClick: () => {},
      active,
    };

    return render(<QueryOperationToggleAction {...props} />);
  }

  it('should correctly set pressed state', () => {
    setup(false);

    expect(
      screen.getByRole('button', {
        name: selectors.components.QueryEditorRow.actionButton('test'),
        pressed: false,
      })
    ).toBeInTheDocument();

    setup(true);

    expect(
      screen.getByRole('button', {
        name: selectors.components.QueryEditorRow.actionButton('test'),
        pressed: true,
      })
    ).toBeInTheDocument();
  });
});
