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
