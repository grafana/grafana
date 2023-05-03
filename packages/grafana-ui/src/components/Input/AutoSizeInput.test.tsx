import { screen, render, fireEvent, waitFor } from '@testing-library/react';
import React from 'react';

import { measureText } from '../../utils/measureText';

import { AutoSizeInput } from './AutoSizeInput';

jest.mock('../../utils/measureText', () => {
  // Mocking measureText
  const measureText = jest.fn().mockImplementation((text: string, fontSize: number) => {
    return { width: text.length * fontSize };
  });

  return { measureText };
});

describe('AutoSizeInput', () => {
  it('should have default minWidth when empty', () => {
    render(<AutoSizeInput />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

    fireEvent.change(input, { target: { value: '' } });

    expect(input.value).toBe('');
    expect(getComputedStyle(inputWrapper).width).toBe('80px');
  });

  it('should have default minWidth for short content', () => {
    render(<AutoSizeInput />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

    fireEvent.change(input, { target: { value: 'foo' } });

    expect(input.value).toBe('foo');
    expect(getComputedStyle(inputWrapper).width).toBe('80px');
  });

  it('should change width for long content', () => {
    render(<AutoSizeInput />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

    fireEvent.change(input, { target: { value: 'very very long value' } });
    expect(getComputedStyle(inputWrapper).width).toBe('304px');
  });

  it('should call onBlur if set when blurring', () => {
    const onBlur = jest.fn();
    const onCommitChange = jest.fn();
    render(<AutoSizeInput onBlur={onBlur} onCommitChange={onCommitChange} />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');

    fireEvent.blur(input);

    expect(onBlur).toHaveBeenCalled();
    expect(onCommitChange).not.toHaveBeenCalled();
  });

  it('should call onCommitChange if not set when blurring', () => {
    const onCommitChange = jest.fn();
    render(<AutoSizeInput onCommitChange={onCommitChange} />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');

    fireEvent.blur(input);

    expect(onCommitChange).toHaveBeenCalled();
  });

  it('should call onKeyDown if set when keydown', () => {
    const onKeyDown = jest.fn();
    const onCommitChange = jest.fn();
    render(<AutoSizeInput onKeyDown={onKeyDown} onCommitChange={onCommitChange} />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onKeyDown).toHaveBeenCalled();
    expect(onCommitChange).not.toHaveBeenCalled();
  });

  it('should call onCommitChange if not set when keydown', () => {
    const onCommitChange = jest.fn();
    render(<AutoSizeInput onCommitChange={onCommitChange} />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');

    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onCommitChange).toHaveBeenCalled();
  });

  it('should respect min width', async () => {
    render(<AutoSizeInput minWidth={4} defaultValue="" />);

    await waitFor(() => expect(measureText).toHaveBeenCalled());

    expect(getComputedStyle(screen.getByTestId('input-wrapper')).width).toBe('32px');
  });

  it('should respect max width', async () => {
    render(
      <AutoSizeInput
        minWidth={1}
        maxWidth={4}
        defaultValue="thisisareallylongvalueandwhenisaylongireallymeanreallylongwithlotsofcharacterscommingfromuserinputwhotookthetimetocomeupwithalongstreamofcharacters"
      />
    );

    await waitFor(() => expect(measureText).toHaveBeenCalled());

    expect(getComputedStyle(screen.getByTestId('input-wrapper')).width).toBe('32px');
  });
});
