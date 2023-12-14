import { render, screen } from '@testing-library/react';
import React, { useEffect, useRef, useState } from 'react';

import { dateTimeForTimeZone } from '@grafana/data';
import { convertRawToRange } from '@grafana/data/src/datetime/rangeutil';
import { LogsSortOrder } from '@grafana/schema';

import { InfiniteScroll, Props } from './InfiniteScroll';

const defaultTz = 'browser';

const absoluteRange = {
  from: 1702006500,
  to: 1702006800,
};
const defaultRange = convertRawToRange({
  from: dateTimeForTimeZone(defaultTz, absoluteRange.from),
  to: dateTimeForTimeZone(defaultTz, absoluteRange.to),
});

const defaultProps: Omit<Props, 'children'> = {
  loading: false,
  loadMoreLogs: jest.fn(),
  range: defaultRange,
  rows: [],
  sortOrder: LogsSortOrder.Descending,
  timeZone: 'browser',
};

function ScrollWithWrapper({ children, ...props }: Props) {
  const [initialized, setInitialized] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Required to get the ref
    if (scrollRef.current && !initialized) {
      setInitialized(true);
    }
  }, [initialized]);

  return (
    <div style={{ height: 40, overflowY: 'scroll' }} ref={scrollRef} data-testid="scroll-element">
      {initialized && (
        <InfiniteScroll {...props} scrollElement={scrollRef.current!}>
          {children}
        </InfiniteScroll>
      )}
    </div>
  );
}

describe('InfiniteScroll', () => {
  test('Wraps components without adding DOM elements', async () => {
    const { container } = render(
      <ScrollWithWrapper {...defaultProps}>
        <div data-testid="contents" />
      </ScrollWithWrapper>
    );

    expect(await screen.findByTestId('contents')).toBeInTheDocument();
    expect(container).toMatchInlineSnapshot(`
      <div>
        <div
          data-testid="scroll-element"
          style="height: 40px; overflow-y: scroll;"
        >
          <div
            data-testid="contents"
          />
        </div>
      </div>
`);
  });
});
