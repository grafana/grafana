import { render, act, RenderResult } from '@testing-library/react';
import { ComponentType } from 'react';
import { Subject } from 'rxjs';

import { ObservablePropsWrapper } from './ObservablePropsWrapper';

interface TestProps {
  value: string;
}

const ChildComponent: ComponentType<TestProps> = ({ value }: TestProps) => <div data-testid="child">{value}</div>;

function ComponentUnderTest(subject: Subject<TestProps>, value: string) {
  return <ObservablePropsWrapper watch={subject} initialSubProps={{ value }} child={ChildComponent} />;
}

describe('ObservablePropsWrapper', () => {
  let subject: Subject<TestProps>;
  let renderResult: RenderResult;

  beforeEach(() => {
    subject = new Subject<TestProps>();
    renderResult = render(ComponentUnderTest(subject, 'initial'));
  });

  it('renders child with initialSubProps before any emission', () => {
    const { getByTestId } = renderResult;

    expect(getByTestId('child')).toHaveTextContent('initial');
  });

  it('updates child props on emission', () => {
    const { getByTestId } = renderResult;

    act(() => {
      subject.next({ value: 'updated' });
    });

    expect(getByTestId('child')).toHaveTextContent('updated');
  });

  it('unsubscribes on unmount', () => {
    const { unmount } = renderResult;

    expect(subject.observed).toBe(true);
    unmount();
    expect(subject.observed).toBe(false);
  });

  it('does not re-subscribes when watch changes', () => {
    const subject2 = new Subject<TestProps>();

    const { rerender, getByTestId } = renderResult;

    act(() => {
      subject.next({ value: 'from-subject1' });
    });
    expect(getByTestId('child')).toHaveTextContent('from-subject1');

    rerender(ComponentUnderTest(subject2, 'initial'));

    act(() => {
      subject.next({ value: 'old-subject-emission' });
    });
    expect(getByTestId('child')).toHaveTextContent('old-subject-emission');

    act(() => {
      subject2.next({ value: 'from-subject2' });
    });
    expect(getByTestId('child')).toHaveTextContent('old-subject-emission');
  });

  it('does not reset state when initialSubProps changes after mount', () => {
    const { rerender, getByTestId } = renderResult;

    act(() => {
      subject.next({ value: 'emitted' });
    });
    expect(getByTestId('child')).toHaveTextContent('emitted');

    rerender(ComponentUnderTest(subject, 'new-initial'));

    expect(getByTestId('child')).toHaveTextContent('emitted');
  });

  it('does not throw when observable completes', () => {
    const { getByTestId } = renderResult;
    expect(() => {
      act(() => {
        subject.complete();
      });
    }).not.toThrow();
    expect(getByTestId('child')).toHaveTextContent('initial');
  });
});
