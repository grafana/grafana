import { act, renderHook, waitFor } from '@testing-library/react';
import { StrictMode, type PropsWithChildren } from 'react';

import { FlagKeys } from '@grafana/runtime/internal';
import { setTestFlags } from '@grafana/test-utils/unstable';

import { TextMode } from '../panelcfg.gen';

import { createTemplateSandbox } from './templateSandbox/client';
import { type TemplateResult } from './templateSandbox/protocol';
import { useTemplateContent } from './useTemplateContent';

jest.mock('./templateSandbox/client', () => ({ createTemplateSandbox: jest.fn() }));
const replaceVariables = (value: string) => value;

beforeEach(() => setTestFlags({ [FlagKeys.TextNewFeatures]: true }));
afterEach(() => setTestFlags({}));

function setup() {
  const requests: Array<{ resolve: (value: TemplateResult) => void; signal?: AbortSignal }> = [];
  const dispose = jest.fn();
  jest.mocked(createTemplateSandbox).mockReturnValue({
    disposed: false,
    dispose,
    render: jest.fn((_input, _resolver, signal) => new Promise((resolve) => requests.push({ resolve, signal }))),
  } as unknown as ReturnType<typeof createTemplateSandbox>);
  const hook = renderHook(({ content }) => useTemplateContent({ content, mode: TextMode.HTML }, replaceVariables), {
    initialProps: { content: '{{first}}' },
    wrapper: ({ children }: PropsWithChildren) => <StrictMode>{children}</StrictMode>,
  });
  return { ...hook, requests, dispose };
}

it('ignores late output from a superseded template and disposes on unmount', async () => {
  const { result, rerender, unmount, requests, dispose } = setup();
  await waitFor(() => expect(requests).toHaveLength(1));
  rerender({ content: '{{second}}' });
  await waitFor(() => expect(requests).toHaveLength(2));
  expect(requests[0].signal?.aborted).toBe(true);
  await act(async () => requests[1].resolve({ content: 'second', readRows: false }));
  expect(result.current.content).toBe('second');
  await act(async () => requests[0].resolve({ content: 'first', readRows: false }));
  expect(result.current.content).toBe('second');
  unmount();
  expect(dispose).toHaveBeenCalledTimes(1);
});

it('cancels a pending render on unmount', async () => {
  const { unmount, requests, dispose } = setup();
  await waitFor(() => expect(requests).toHaveLength(1));
  unmount();
  expect(requests[0].signal?.aborted).toBe(true);
  expect(dispose).toHaveBeenCalledTimes(1);
  await act(async () => requests[0].resolve({ content: 'late', readRows: false }));
});

it('renders plain text and code synchronously without creating a frame', () => {
  jest.mocked(createTemplateSandbox).mockClear();
  const { result } = renderHook(() =>
    useTemplateContent({ content: '{{literal}}', mode: TextMode.Code }, replaceVariables)
  );
  expect(result.current.content).toBe('{{literal}}');
  expect(createTemplateSandbox).not.toHaveBeenCalled();
});

it('releases the frame when content no longer needs Handlebars', async () => {
  const { result, rerender, requests, dispose } = setup();
  await waitFor(() => expect(requests).toHaveLength(1));
  rerender({ content: 'plain text' });
  expect(result.current.content).toBe('plain text');
  expect(dispose).toHaveBeenCalledTimes(1);
  expect(requests[0].signal?.aborted).toBe(true);
  await act(async () => requests[0].resolve({ content: 'stale', readRows: false }));
  expect(result.current.content).toBe('plain text');
});
