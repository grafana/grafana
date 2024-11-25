import { screen, render, fireEvent, waitFor } from '@testing-library/react';

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
  it('should support default Input API', () => {
    const onChange = jest.fn();
    render(<AutoSizeInput onChange={onChange} value="" />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    fireEvent.change(input, { target: { value: 'foo' } });

    expect(onChange).toHaveBeenCalled();
  });

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

  it('should use placeholder for width if input is empty', () => {
    render(<AutoSizeInput placeholder="very very long value" />);

    const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');
    expect(getComputedStyle(inputWrapper).width).toBe('304px');
  });

  it('should use value for width even with a placeholder', () => {
    render(<AutoSizeInput value="less long value" placeholder="very very long value" />);

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

  it('should update the input value if the value prop changes', () => {
    const { rerender } = render(<AutoSizeInput value="Initial" />);

    // Get a handle on the original input element (to catch if it's unmounted)
    // And check the initial value
    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    expect(input.value).toBe('Initial');

    // Rerender and make sure it clears the input
    rerender(<AutoSizeInput value="Updated" />);
    expect(input.value).toBe('Updated');
  });

  it('should clear the input when the value is changed to an empty string', () => {
    const { rerender } = render(<AutoSizeInput value="Initial" />);

    // Get a handle on the original input element (to catch if it's unmounted)
    // And check the initial value
    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    expect(input.value).toBe('Initial');

    // Rerender and make sure it clears the input
    rerender(<AutoSizeInput value="" />);
    expect(input.value).toBe('');
  });

  it('should render string values as expected', () => {
    render(<AutoSizeInput value="foo" />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    expect(input.value).toBe('foo');
  });

  it('should render undefined values as expected', () => {
    render(<AutoSizeInput value={undefined} />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    expect(input.value).toBe('');
  });

  it('should render null values as expected', () => {
    // @ts-expect-error - look - the types forbid this, but we previously fixed an issue if the value is null
    // so lets test it just in case https://github.com/grafana/grafana/pull/94078
    render(<AutoSizeInput value={null} />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    expect(input.value).toBe('');
  });

  it('should render array values as expected', () => {
    render(<AutoSizeInput value={['hello', 'world']} />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    expect(input.value).toBe('hello,world');
  });
});
