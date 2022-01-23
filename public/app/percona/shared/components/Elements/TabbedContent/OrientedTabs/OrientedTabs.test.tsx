import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrientedTabs } from './OrientedTabs';
import { ContentTab } from '../TabbedContent.types';

describe('OrientedTabs', () => {
  it('should call tabClick', () => {
    const tabs: ContentTab[] = [{ label: 'label', key: 'tab_1', component: <></> }];
    const spy = jest.fn();
    render(<OrientedTabs tabs={tabs} tabClick={spy} />);
    const tabEl = screen.getByText('label');
    fireEvent.click(tabEl);

    expect(spy).toHaveBeenCalledWith('tab_1');
  });
});
