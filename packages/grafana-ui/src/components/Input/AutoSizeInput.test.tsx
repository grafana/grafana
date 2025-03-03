import { screen, render, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

import { measureText } from '../../utils/measureText';

import { AutoSizeInput } from './AutoSizeInput';

jest.mock('../../utils/measureText', () => {
  // Mocking measureText
  const measureText = jest.fn().mockImplementation((text: string, fontSize: number) => {
    return { width: text.length * fontSize };
  });

  return { measureText };
});

// The length calculation should be (text.length * 14) + 24
const FIXTURES = {
  'Initial value': '206px',
  'Initial value with more text': '416px',
  'A new value': '178px',
  'Placeholder text': '248px',
  _emptyString: '80px', // min width
  foo: '80px', // min width
} as const;

describe('AutoSizeInput', () => {
  it('all the test fixture strings should be a different length', () => {
    const lengths = Object.keys(FIXTURES).map((key) => key.length);

    // The unique number of lengths should be the same as the number of items in the object
    const uniqueLengths = new Set(lengths);
    expect(uniqueLengths.size).toBe(lengths.length);
  });

  describe('as an uncontrolled component', () => {
    it('renders an initial value prop with correct width', async () => {
      render(<AutoSizeInput value="Initial value" />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      expect(input.value).toBe('Initial value');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['Initial value']);
    });

    it('renders an updated value prop with correct width', () => {
      const { rerender } = render(<AutoSizeInput value="Initial value" />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      rerender(<AutoSizeInput value="A new value" />);

      expect(input.value).toBe('A new value');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['A new value']);
    });

    it('renders the user typing in the input with correct width', async () => {
      render(<AutoSizeInput value="" />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      await userEvent.type(input, 'Initial value with more text');

      expect(input.value).toBe('Initial value with more text');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['Initial value with more text']);
    });

    it('renders correctly after the user clears the input', async () => {
      render(<AutoSizeInput value="Initial value" />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      await userEvent.clear(input);

      expect(input.value).toBe('');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES._emptyString);
    });

    it('renders correctly with a placeholder after the user clears the input', async () => {
      render(<AutoSizeInput value="Initial value" placeholder="Placeholder text" />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      await userEvent.clear(input);

      expect(input.value).toBe('');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['Placeholder text']);
    });

    it('emits onCommitChange when you blur the input', () => {
      const onCommitChange = jest.fn();
      render(<AutoSizeInput value="Initial value" onCommitChange={onCommitChange} />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');

      fireEvent.blur(input);

      expect(onCommitChange).toHaveBeenCalledTimes(1);
    });

    it('emits onBlur instead of onCommitChange when you blur the input', () => {
      const onCommitChange = jest.fn();
      const onBlur = jest.fn();
      render(<AutoSizeInput value="Initial value" onCommitChange={onCommitChange} onBlur={onBlur} />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');

      fireEvent.blur(input);

      expect(onCommitChange).not.toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('emits the value when you press enter', async () => {
      const onCommitChange = jest.fn();
      render(<AutoSizeInput value="Initial value" onCommitChange={onCommitChange} />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');

      await userEvent.type(input, '{enter}');

      expect(onCommitChange).toHaveBeenCalledTimes(1);
    });

    it("allows the input to empty when there's a default value", async () => {
      const onCommitChange = jest.fn();
      render(<AutoSizeInput defaultValue="Initial value" onCommitChange={onCommitChange} />);
      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      await userEvent.clear(input);
      await userEvent.type(input, '{enter}');

      expect(input.value).toBe('');
      expect(onCommitChange).toHaveBeenCalledTimes(1);
      expect(onCommitChange).toHaveBeenCalledWith(
        expect.objectContaining({ target: expect.objectContaining({ value: '' }) })
      );
    });
  });

  describe('as a controlled component', () => {
    function ControlledAutoSizeInputExample() {
      const [value, setValue] = useState('');
      return <AutoSizeInput value={value} onChange={(event) => setValue(event.currentTarget.value)} />;
    }

    // AutoSizeInput is considered controlled when it has both value and onChange props

    it('renders a value prop with correct width', () => {
      const onChange = jest.fn();
      render(<AutoSizeInput value="Initial value" onChange={onChange} />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      expect(input.value).toBe('Initial value');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['Initial value']);
    });

    it('renders an updated value prop with correct width', () => {
      const onChange = jest.fn();
      const { rerender } = render(<AutoSizeInput value="Initial value" onChange={onChange} />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      rerender(<AutoSizeInput value="A new value" onChange={onChange} />);

      expect(input.value).toBe('A new value');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['A new value']);
    });

    it('as a user types, the value is not updated because it is controlled', async () => {
      const onChange = jest.fn();
      render(<AutoSizeInput value="Initial value" onChange={onChange} />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      await userEvent.type(input, ' and more text');

      expect(input.value).toBe('Initial value');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['Initial value']);
    });

    it('functions correctly as a controlled input', async () => {
      render(<ControlledAutoSizeInputExample />);
      const input: HTMLInputElement = screen.getByTestId('autosize-input');
      const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

      await userEvent.type(input, 'Initial value with more text');
      expect(input.value).toBe('Initial value with more text');
      expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['Initial value with more text']);
    });

    it('emits onCommitChange when you blur the input', () => {
      const onCommitChange = jest.fn();
      const onChange = jest.fn();
      render(<AutoSizeInput value="Initial value" onCommitChange={onCommitChange} onChange={onChange} />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');

      fireEvent.blur(input);

      expect(onCommitChange).toHaveBeenCalledTimes(1);
    });

    it('emits onBlur instead of onCommitChange when you blur the input', () => {
      const onCommitChange = jest.fn();
      const onBlur = jest.fn();
      const onChange = jest.fn();
      render(
        <AutoSizeInput value="Initial value" onCommitChange={onCommitChange} onBlur={onBlur} onChange={onChange} />
      );

      const input: HTMLInputElement = screen.getByTestId('autosize-input');

      fireEvent.blur(input);

      expect(onCommitChange).not.toHaveBeenCalled();
      expect(onBlur).toHaveBeenCalledTimes(1);
    });

    it('emits the value when you press enter', async () => {
      const onCommitChange = jest.fn();
      const onChange = jest.fn();
      render(<AutoSizeInput value="Initial value" onCommitChange={onCommitChange} onChange={onChange} />);

      const input: HTMLInputElement = screen.getByTestId('autosize-input');

      await userEvent.type(input, '{enter}');

      expect(onCommitChange).toHaveBeenCalledTimes(1);
    });
  });

  it('should have default minWidth when empty', () => {
    render(<AutoSizeInput />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

    expect(input.value).toBe('');
    expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES._emptyString);
  });

  it('should have default minWidth for short content', () => {
    render(<AutoSizeInput value="foo" />);

    const input: HTMLInputElement = screen.getByTestId('autosize-input');
    const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

    expect(input.value).toBe('foo');
    expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['foo']);
  });

  it('should use placeholder for width if input is empty', () => {
    render(<AutoSizeInput value="" placeholder="Placeholder text" />);

    const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');
    expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['Placeholder text']);
  });

  it('should use value for width even with a placeholder', () => {
    render(<AutoSizeInput value="Initial value" placeholder="Placeholder text" />);

    const inputWrapper: HTMLDivElement = screen.getByTestId('input-wrapper');

    expect(getComputedStyle(inputWrapper).width).toBe(FIXTURES['Initial value']);
  });

  it('should respect min width', async () => {
    render(<AutoSizeInput minWidth={4} defaultValue="" />);

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
