import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';

import { locationService } from '@grafana/runtime';

import { PanelNotSupported, Props } from './PanelNotSupported';
import { PanelEditorTabId } from './types';

const setupTestContext = (options: Partial<Props>) => {
  const defaults: Props = { message: '' };
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
    it('then correct action should be dispatched', async () => {
      setupTestContext({});
      await userEvent.click(screen.getByRole('button', { name: /go back to queries/i }));
      expect(locationService.getSearchObject().tab).toBe(PanelEditorTabId.Query);
    });
  });
});
