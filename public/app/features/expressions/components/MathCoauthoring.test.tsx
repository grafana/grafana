import { fireEvent, render, screen } from '@testing-library/react';

import {
  type QueryCoauthoringEditorHandle,
  type QueryCoauthoringEditorHost,
} from 'app/features/dashboard-scene/panel-edit/PanelEditNext/QueryEditor/coauthoring/queryCoauthoringContracts';

import { ExpressionQueryType } from '../types';

import { Math } from './Math';

it('registers the real Math input, reports offsets, forwards shortcuts and cleans host replacement', () => {
  let handle: QueryCoauthoringEditorHandle | undefined;
  const stop = jest.fn();
  const host: QueryCoauthoringEditorHost = {
    version: 1,
    register: jest.fn((next) => {
      handle = next;
      return stop;
    }),
    invoke: jest.fn(),
  };
  const onChange = jest.fn();
  const props = {
    query: { refId: 'B', type: ExpressionQueryType.math, expression: '$A + 1' },
    onChange,
    onRunQuery: jest.fn(),
    labelWidth: 10,
  };
  const view = render(<Math {...props} queryCoauthoring={host} />);
  const input = screen.getByRole('textbox');
  if (!(input instanceof HTMLTextAreaElement) || !handle) {
    throw new Error('Expected registered Math editor');
  }
  input.setSelectionRange(0, 2);
  fireEvent.select(input);
  expect(handle.getSelection()?.ranges).toEqual([{ from: 0, to: 2 }]);
  const selection = jest.fn();
  const unsubscribe = handle.subscribe(selection);
  fireEvent.keyUp(input);
  expect(selection).toHaveBeenCalledTimes(1);
  fireEvent.keyDown(input, { key: '.', ctrlKey: true });
  input.setSelectionRange(0, 0);
  fireEvent.keyDown(input, { key: '.', metaKey: true });
  expect(host.invoke).toHaveBeenCalledTimes(2);
  view.rerender(<Math {...props} query={{ ...props.query, expression: '$A + 2' }} queryCoauthoring={host} />);
  expect(onChange).not.toHaveBeenCalled();
  expect(host.register).toHaveBeenCalledTimes(1);
  fireEvent.blur(input);
  expect(props.onRunQuery).not.toHaveBeenCalled();
  fireEvent.change(input, { target: { value: '$A + 3' } });
  expect(onChange).toHaveBeenCalledWith({ ...props.query, expression: '$A + 3' });
  fireEvent.blur(input);
  expect(props.onRunQuery).toHaveBeenCalledTimes(1);
  unsubscribe();
  view.rerender(<Math {...props} />);
  expect(stop).toHaveBeenCalledTimes(1);
  fireEvent.blur(input);
  expect(props.onRunQuery).toHaveBeenCalledTimes(2);
  fireEvent.keyDown(input, { key: '.', ctrlKey: true });
  expect(host.invoke).toHaveBeenCalledTimes(2);
  view.unmount();
});

it('consumes an empty manual edit on blur before a later props-only preview', () => {
  const props = {
    query: { refId: 'B', type: ExpressionQueryType.math, expression: '$A' },
    onChange: jest.fn(),
    onRunQuery: jest.fn(),
    labelWidth: 10,
  };
  const host: QueryCoauthoringEditorHost = { version: 1, register: () => () => {}, invoke: jest.fn() };
  const view = render(<Math {...props} queryCoauthoring={host} />);
  const input = screen.getByRole('textbox');
  fireEvent.change(input, { target: { value: '' } });
  view.rerender(<Math {...props} query={{ ...props.query, expression: '' }} queryCoauthoring={host} />);
  fireEvent.blur(input);
  expect(props.onRunQuery).not.toHaveBeenCalled();
  view.rerender(<Math {...props} query={{ ...props.query, expression: '$A + 2' }} queryCoauthoring={host} />);
  fireEvent.blur(input);
  expect(props.onRunQuery).not.toHaveBeenCalled();
});

it('repaints the Math change when browser wrapping moves it to another row', () => {
  const originalObserver = window.ResizeObserver;
  let resize: (() => void) | undefined;
  const disconnect = jest.fn();
  window.ResizeObserver = class implements ResizeObserver {
    constructor(callback: ResizeObserverCallback) {
      resize = () => callback([], this);
    }
    observe() {}
    unobserve() {}
    disconnect = disconnect;
  };

  let handle: QueryCoauthoringEditorHandle | undefined;
  const host: QueryCoauthoringEditorHost = {
    version: 1,
    register(next) {
      handle = next;
      return () => {};
    },
    invoke: jest.fn(),
  };
  const expression = '$A + $B + $C + $D + 99';
  const createRange = document.createRange.bind(document);
  let rangeTop = 26;
  const rangeMock = jest.spyOn(document, 'createRange').mockImplementation(() => {
    const range = createRange();
    // jsdom has no text layout, so supply the visual row from the browser.
    const rect: DOMRect = {
      x: 0,
      y: rangeTop,
      top: rangeTop,
      right: 12,
      bottom: rangeTop + 20,
      left: 0,
      width: 12,
      height: 20,
      toJSON: () => ({}),
    };
    range.getClientRects = () => Object.assign([rect], { item: (index: number) => (index === 0 ? rect : null) });
    return range;
  });
  try {
    const view = render(
      <Math
        query={{ refId: 'B', type: ExpressionQueryType.math, expression }}
        onChange={jest.fn()}
        onRunQuery={jest.fn()}
        labelWidth={10}
        queryCoauthoring={host}
      />
    );
    const input = screen.getByRole('textbox');
    if (!handle?.showChanges || !(input instanceof HTMLTextAreaElement)) {
      throw new Error('Expected registered Math editor');
    }
    const width = jest.spyOn(input, 'clientWidth', 'get').mockReturnValue(250);
    const background = jest.spyOn(input.style, 'backgroundImage', 'set');
    const from = expression.indexOf('99');
    handle.showChanges([
      {
        original: '$A + $B + $C + $D + 11',
        proposed: expression,
        originalRanges: [{ from, to: from + 2 }],
        proposedRanges: [{ from, to: from + 2 }],
      },
    ]);
    expect(background).toHaveBeenLastCalledWith(expect.stringContaining('transparent 54px'));
    if (!resize) {
      throw new Error('Expected Math editor resize observer');
    }
    rangeTop = 0;
    width.mockReturnValue(780);
    resize();
    expect(background).toHaveBeenLastCalledWith(expect.stringContaining('transparent 2px'));
    view.unmount();
    expect(background).toHaveBeenLastCalledWith('');
    background.mockRestore();
    expect(disconnect).toHaveBeenCalledTimes(1);
  } finally {
    rangeMock.mockRestore();
    window.ResizeObserver = originalObserver;
  }
});
