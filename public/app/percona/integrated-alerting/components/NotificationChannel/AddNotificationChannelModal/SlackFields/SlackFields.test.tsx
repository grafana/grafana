import React from 'react';
import { Form } from 'react-final-form';
import { SlackFields } from './SlackFields';
import { Messages } from '../AddNotificationChannelModal.messages';
import { fireEvent, render, screen } from '@testing-library/react';

describe('SlackFields', () => {
  it('should render correct fields', () => {
    render(<Form onSubmit={jest.fn()} render={() => <SlackFields />} />);

    expect(screen.getByTestId('channel-text-input')).toBeInTheDocument();
  });

  it('should show error when channel has #', () => {
    render(<Form onSubmit={jest.fn()} render={() => <SlackFields />} />);
    expect(screen.getByTestId('channel-field-error-message').innerText).toBeFalsy();

    const channelInput = screen.getByTestId('channel-text-input');
    fireEvent.change(channelInput, { target: { value: '#testchannel' } });

    expect(screen.getByTestId('channel-field-error-message').textContent).toEqual(Messages.invalidChannelName);
  });
});
