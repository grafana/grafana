import { screen, render, fireEvent } from '@testing-library/react';
import React from 'react';

import { AutoSizeInput } from './AutoSizeInput';

jest.mock('@grafana/ui', () => {
  const original = jest.requireActual('@grafana/ui');
  const mockedUi = { ...original };

  // Mocking measureText
  mockedUi.measureText = (text: string, fontSize: number) => {
    return { width: text.length * fontSize };
  };

  return mockedUi;
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
});
