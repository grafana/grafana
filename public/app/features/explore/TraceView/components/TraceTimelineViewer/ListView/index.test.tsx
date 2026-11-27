// Copyright (c) 2017 Uber Technologies, Inc.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { render, screen } from '@testing-library/react';
import * as React from 'react';

import ListView, { type TListViewProps } from './index';

const DATA_LENGTH = 10;

function getHeight(index: number) {
  return index * 2 + 2;
}

function Item(props: React.HTMLProps<HTMLDivElement>) {
  const { children, ...rest } = props;
  return <div {...rest}>{children}</div>;
}

const renderItem: TListViewProps['itemRenderer'] = (itemKey, styles, itemIndex, attrs) => {
  return (
    <Item key={itemKey} style={styles} {...attrs} data-testid="item">
      {itemIndex}
    </Item>
  );
};

const props = {
  dataLength: DATA_LENGTH,
  getIndexFromKey: Number,
  getKeyFromIndex: String,
  initialDraw: 5,
  itemHeightGetter: getHeight,
  itemRenderer: renderItem,
  itemsWrapperClassName: 'SomeClassName',
  viewBuffer: 10,
  viewBufferMin: 5,
  windowScroller: true,
  redraw: {},
};

describe('<ListView />', () => {
  beforeEach(() => {
    render(<ListView {...props} />);
  });

  it('renders without exploding', () => {
    expect(screen.getByTestId('ListView')).toBeInTheDocument();
  });

  it('renders the correct number of items', () => {
    expect(screen.getAllByTestId('item').length).toBe(DATA_LENGTH);
  });
});

// A Document Picture-in-Picture window (the Grafana Assistant pop-out) is another realm, as an iframe is: its
// elements fail this window's `instanceof HTMLElement`.
describe('<ListView /> in another window', () => {
  it('measures the rendered rows', () => {
    const iframe = document.createElement('iframe');
    document.body.appendChild(iframe);
    const otherWindow = iframe.contentDocument!.defaultView!;
    const container = otherWindow.document.body.appendChild(otherWindow.document.createElement('div'));
    // every rendered row is 50px tall
    const clientHeight = jest.spyOn(otherWindow.HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(50);
    const listView = React.createRef<ListView>();

    const { unmount } = render(<ListView {...props} ref={listView} />, { container });

    // measured: rows 0 to 2 are 50px each, rather than the estimated 2, 4 and 6px
    expect(listView.current?.getRowPosition(3).y).toBe(150);
    // Unmount before the iframe goes, or React cannot remove the list from it.
    unmount();
    clientHeight.mockRestore();
    iframe.remove();
  });
});
