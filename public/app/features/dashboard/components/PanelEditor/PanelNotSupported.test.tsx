import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { PanelNotSupported, Props } from './PanelNotSupported';
import { updateLocation } from '../../../../core/actions';
import { PanelEditorTabId } from './types';

const setupTestContext = (options: Partial<Props>) => {
  const defaults: Props = {
    message: '',
    dispatch: jest.fn(),
  };

  const props = { ...defaults, ...options };
  render(<PanelNotSupported {...props} />);

  return { props };
};

describe('PanelNotSupported', () => {
  describe('when component is mounted', () => {
    it('then the supplied message should be shown', () => {
      setupTestContext({ message: 'Expected message' });

      expect(screen.getByRole('heading', { name: /expected message/i })).toBeInTheDocument();
    });

    it('then the back to queries button should exist', () => {
      setupTestContext({ message: 'Expected message' });

      expect(screen.getByRole('button', { name: /go back to queries/i })).toBeInTheDocument();
    });
  });

  describe('when the back to queries button is clicked', () => {
    it('then correct action should be dispatched', () => {
      const {
        props: { dispatch },
      } = setupTestContext({});

      userEvent.click(screen.getByRole('button', { name: /go back to queries/i }));

      expect(dispatch).toHaveBeenCalledTimes(1);
      expect(dispatch).toHaveBeenCalledWith(updateLocation({ query: { tab: PanelEditorTabId.Query }, partial: true }));
    });
  });
});
