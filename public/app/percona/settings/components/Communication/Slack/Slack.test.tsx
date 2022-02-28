import React from 'react';
import { Slack } from './Slack';
import { fireEvent, render, screen } from '@testing-library/react';

describe('Slack::', () => {
  it('Renders with props', () => {
    render(
      <Slack
        settings={{
          url: 'test',
        }}
        updateSettings={() => {}}
      />
    );

    expect(screen.getByTestId('url-text-input')).toHaveValue('test');
  });

  it('Disables apply changes on initial values', () => {
    render(
      <Slack
        settings={{
          url: 'test',
        }}
        updateSettings={() => {}}
      />
    );
    const button = screen.getByRole('button');

    expect(button).toBeDisabled();
  });

  it('Calls apply changes', () => {
    const updateSettings = jest.fn();
    render(
      <Slack
        settings={{
          url: 'test',
        }}
        updateSettings={updateSettings}
      />
    );

    const input = screen.getByTestId('url-text-input');
    fireEvent.change(input, { target: { value: 'new key' } });

    fireEvent.submit(screen.getByTestId('slack-form'));

    expect(updateSettings).toHaveBeenCalled();
  });
});
