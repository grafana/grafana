import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCallback } from 'react';

import { createDataFrame, createTheme, FieldType } from '@grafana/data';

import FlameGraphContainer from './FlameGraphContainer';

import 'jest-canvas-mock';

jest.mock('@grafana/assistant', () => ({
  useAssistant: jest.fn().mockReturnValue({ isLoading: false, isEnabled: false, openAssistant: jest.fn() }),
  createAssistantContextItem: jest.fn(),
  providePageContext: jest.fn(),
}));

const profileBefore = {
  fields: [
    { name: 'level', values: [0, 1, 2, 1, 2] },
    { name: 'value', values: [100, 60, 60, 40, 40] },
    { name: 'self', values: [0, 0, 60, 0, 40] },
    { name: 'label', values: ['total', 'a', 'target', 'b', 'target'], type: FieldType.string },
  ],
};

const profileAfter = {
  fields: [
    { name: 'level', values: [0, 1, 2, 2, 1, 2] },
    { name: 'value', values: [100, 60, 20, 40, 35, 25] },
    { name: 'self', values: [0, 0, 20, 40, 0, 25] },
    { name: 'label', values: ['total', 'a', 'nc', 'target', 'b', 'target'], type: FieldType.string },
  ],
};

const frame = (d: typeof profileBefore) => {
  const f = createDataFrame(d);
  f.meta = { custom: { ProfileTypeID: 'cpu:samples:count:cpu:nanoseconds' } };
  return f;
};

const sameCallPathShare = '25% of total';
const sameLabelShare = '40% of total';
const sameRowIndexesShare = '35% of total';

const Harness = ({ which, keepFocus = true }: { which: 'before' | 'after'; keepFocus?: boolean }) => {
  const getTheme = useCallback(() => createTheme({ colors: { mode: 'dark' } }), []);
  return (
    <FlameGraphContainer
      data={frame(which === 'before' ? profileBefore : profileAfter)}
      getTheme={getTheme}
      keepFocusOnDataChange={keepFocus}
      disableCollapsing={true}
    />
  );
};

const focusTargetUnderB = async () => {
  Object.defineProperty(HTMLCanvasElement.prototype, 'clientWidth', { configurable: true, value: 500 });
  const click = new MouseEvent('click', { bubbles: true });
  Object.defineProperty(click, 'offsetX', { get: () => 400 });
  Object.defineProperty(click, 'offsetY', { get: () => 2 * 22 + 11 });
  fireEvent(await screen.findByTestId('flameGraph'), click);
  await userEvent.click(screen.getByText('Focus block'));
  await waitFor(() => expect(screen.getByText(sameLabelShare)).toBeInTheDocument());
};

it('keeps the focus on the same call path when the data changes', async () => {
  const { rerender } = render(<Harness which="before" />);
  await focusTargetUnderB();

  rerender(<Harness which="after" />);

  await waitFor(() => expect(screen.getByText(sameCallPathShare)).toBeInTheDocument());
  expect(screen.queryByText(sameRowIndexesShare)).not.toBeInTheDocument();
});

it('drops the focus when the data changes and keepFocusOnDataChange is off', async () => {
  const { rerender } = render(<Harness which="before" keepFocus={false} />);
  await focusTargetUnderB();

  rerender(<Harness which="after" keepFocus={false} />);

  await waitFor(() => expect(screen.queryByText(/% of total/)).not.toBeInTheDocument());
});
