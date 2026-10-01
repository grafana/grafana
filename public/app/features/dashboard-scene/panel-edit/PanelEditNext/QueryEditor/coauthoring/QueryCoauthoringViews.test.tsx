import { act, fireEvent, render, screen } from '@testing-library/react';

import { QueryCoauthoringPromptInput } from './QueryCoauthoringViews';

const initialPrompt = {
  placeholder: 'Describe a quick change...',
  ariaLabel: 'Describe a query change',
  actionLabel: 'Coauthor',
};

const clarificationPrompt = {
  placeholder: 'Add extra detail...',
  ariaLabel: 'Add extra detail',
  actionLabel: 'Continue',
};

function renderPrompt({ placeholder, ariaLabel, actionLabel }: typeof initialPrompt, focusTrigger = 'initial') {
  const result = render(
    <>
      <button>Monaco editor</button>
    </>
  );
  screen.getByRole('button', { name: 'Monaco editor' }).focus();

  result.rerender(
    <>
      <button>Monaco editor</button>
      <button>Another control</button>
      <QueryCoauthoringPromptInput
        focusTrigger={`${ariaLabel}-${focusTrigger}`}
        value=""
        placeholder={placeholder}
        ariaLabel={ariaLabel}
        actionLabel={actionLabel}
        disabled={false}
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    </>
  );

  return result;
}

describe('QueryCoauthoringPromptInput', () => {
  let animationFrames: Map<number, FrameRequestCallback>;
  let cancelAnimationFrameSpy: jest.SpyInstance;
  let requestAnimationFrameSpy: jest.SpyInstance;

  beforeEach(() => {
    let nextAnimationFrameId = 1;
    animationFrames = new Map();
    requestAnimationFrameSpy = jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      const id = nextAnimationFrameId++;
      animationFrames.set(id, callback);
      return id;
    });
    cancelAnimationFrameSpy = jest
      .spyOn(window, 'cancelAnimationFrame')
      .mockImplementation((id) => animationFrames.delete(id));
  });

  afterEach(() => {
    requestAnimationFrameSpy.mockRestore();
    cancelAnimationFrameSpy.mockRestore();
  });

  it('does not submit with Enter while the action is disabled', () => {
    const onSubmit = jest.fn();
    render(
      <QueryCoauthoringPromptInput
        value="Use increase"
        placeholder={initialPrompt.placeholder}
        ariaLabel={initialPrompt.ariaLabel}
        actionLabel={initialPrompt.actionLabel}
        disabled
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    fireEvent.keyDown(screen.getByRole('textbox', { name: initialPrompt.ariaLabel }), { key: 'Enter' });

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('does not submit with Enter while text composition is active', () => {
    const onSubmit = jest.fn();
    render(
      <QueryCoauthoringPromptInput
        value="Use increase"
        placeholder={initialPrompt.placeholder}
        ariaLabel={initialPrompt.ariaLabel}
        actionLabel={initialPrompt.actionLabel}
        disabled={false}
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    const eventWasNotCancelled = fireEvent.keyDown(screen.getByRole('textbox', { name: initialPrompt.ariaLabel }), {
      key: 'Enter',
      isComposing: true,
    });

    expect(eventWasNotCancelled).toBe(true);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('restores focus after programmatic focus theft when semantic reading completes', () => {
    const { rerender } = renderPrompt(initialPrompt);
    const prompt = screen.getByRole('textbox', { name: initialPrompt.ariaLabel });
    drainAnimationFrames();
    expect(prompt).toHaveFocus();

    fireEvent.keyDown(prompt, { key: 'a' });
    fireEvent.keyDown(prompt, { key: 'Enter' });
    const anotherControl = screen.getByRole('button', { name: 'Another control' });
    anotherControl.focus();
    rerender(
      <>
        <button>Monaco editor</button>
        <button>Another control</button>
        <QueryCoauthoringPromptInput
          focusTrigger="initial-identified"
          value=""
          placeholder={initialPrompt.placeholder}
          ariaLabel={initialPrompt.ariaLabel}
          actionLabel={initialPrompt.actionLabel}
          disabled={false}
          onChange={jest.fn()}
          onSubmit={jest.fn()}
        />
      </>
    );
    drainAnimationFrames();

    expect(prompt).toHaveFocus();
  });

  it('preserves deliberate outside focus when semantic reading completes', () => {
    const { rerender } = renderPrompt(initialPrompt);
    const prompt = screen.getByRole('textbox', { name: initialPrompt.ariaLabel });
    drainAnimationFrames();
    expect(prompt).toHaveFocus();

    const anotherControl = screen.getByRole('button', { name: 'Another control' });
    fireEvent.pointerDown(anotherControl);
    anotherControl.focus();
    rerender(
      <>
        <button>Monaco editor</button>
        <button>Another control</button>
        <QueryCoauthoringPromptInput
          focusTrigger="initial-identified"
          value=""
          placeholder={initialPrompt.placeholder}
          ariaLabel={initialPrompt.ariaLabel}
          actionLabel={initialPrompt.actionLabel}
          disabled={false}
          onChange={jest.fn()}
          onSubmit={jest.fn()}
        />
      </>
    );
    drainAnimationFrames();

    expect(anotherControl).toHaveFocus();
  });

  it('preserves Tab navigation away from the prompt when semantic reading completes', () => {
    const userGestureRef = { current: false };
    const { rerender } = render(<button>Monaco editor</button>);
    screen.getByRole('button', { name: 'Monaco editor' }).focus();
    rerender(
      <>
        <button>Monaco editor</button>
        <button>Another control</button>
        <QueryCoauthoringPromptInput
          key="reading"
          focusTrigger="initial-reading"
          userGestureRef={userGestureRef}
          value=""
          placeholder={initialPrompt.placeholder}
          ariaLabel={initialPrompt.ariaLabel}
          actionLabel={initialPrompt.actionLabel}
          disabled={false}
          onChange={jest.fn()}
          onSubmit={jest.fn()}
        />
      </>
    );
    const prompt = screen.getByRole('textbox', { name: initialPrompt.ariaLabel });
    drainAnimationFrames();
    expect(prompt).toHaveFocus();

    const anotherControl = screen.getByRole('button', { name: 'Another control' });
    fireEvent.keyDown(prompt, { key: 'Tab' });
    anotherControl.focus();
    rerender(
      <>
        <button>Monaco editor</button>
        <button>Another control</button>
        <QueryCoauthoringPromptInput
          key="identified"
          focusTrigger="initial-identified"
          userGestureRef={userGestureRef}
          value=""
          placeholder={initialPrompt.placeholder}
          ariaLabel={initialPrompt.ariaLabel}
          actionLabel={initialPrompt.actionLabel}
          disabled={false}
          onChange={jest.fn()}
          onSubmit={jest.fn()}
        />
      </>
    );
    drainAnimationFrames();

    expect(anotherControl).toHaveFocus();
  });

  function runNextFocusFrame() {
    expect(animationFrames.size).toBe(1);
    const [[id, callback]] = animationFrames;
    animationFrames.delete(id);
    act(() => callback(0));
  }

  function runFocusSettle() {
    runNextFocusFrame();
    runNextFocusFrame();
    runNextFocusFrame();
  }

  function drainAnimationFrames() {
    while (animationFrames.size > 0) {
      runNextFocusFrame();
    }
  }

  it('focuses the initial change-description prompt after its scheduled frames', () => {
    renderPrompt(initialPrompt);
    const prompt = screen.getByRole('textbox', { name: 'Describe a query change' });

    runFocusSettle();

    expect(prompt).toHaveFocus();
  });

  it('focuses the clarification prompt after its scheduled frames', () => {
    renderPrompt(clarificationPrompt);
    const prompt = screen.getByRole('textbox', { name: 'Add extra detail' });

    runFocusSettle();

    expect(prompt).toHaveFocus();
  });

  it('does not steal focus when the user focuses another control during the settle', () => {
    renderPrompt(initialPrompt);
    const prompt = screen.getByRole('textbox', { name: 'Describe a query change' });
    const anotherControl = screen.getByRole('button', { name: 'Another control' });

    runNextFocusFrame();
    runNextFocusFrame();
    anotherControl.focus();
    runNextFocusFrame();

    expect(anotherControl).toHaveFocus();
    expect(prompt).not.toHaveFocus();
  });

  it('cancels the initial focus frame when the prompt unmounts immediately', () => {
    const { unmount } = renderPrompt(initialPrompt);
    const [firstFocusFrame] = animationFrames.keys();

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(firstFocusFrame);
    expect(animationFrames.size).toBe(0);
  });

  it('cancels the second settle frame when the prompt unmounts after one frame', () => {
    const { unmount } = renderPrompt(initialPrompt);

    runNextFocusFrame();
    const [secondFocusFrame] = animationFrames.keys();

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(secondFocusFrame);
    expect(animationFrames.size).toBe(0);
  });

  it('cancels the focus frame when the prompt unmounts after both settle frames', () => {
    const { unmount } = renderPrompt(initialPrompt);

    runNextFocusFrame();
    runNextFocusFrame();
    const [focusFrame] = animationFrames.keys();

    unmount();

    expect(cancelAnimationFrameSpy).toHaveBeenCalledWith(focusFrame);
    expect(animationFrames.size).toBe(0);
  });
});
