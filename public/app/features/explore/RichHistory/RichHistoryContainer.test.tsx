import { render } from '@testing-library/react';
import React from 'react';

import { ExploreId } from '../../../types/explore';

import { Tabs } from './RichHistory';
import { RichHistoryContainer, Props } from './RichHistoryContainer';

jest.mock('../state/selectors', () => ({ getExploreDatasources: jest.fn() }));

const setup = (propOverrides?: Partial<Props>) => {
  const props: Props = {
    width: 500,
    exploreId: ExploreId.left,
    activeDatasourceInstance: 'Test datasource',
    richHistory: [],
    firstTab: Tabs.RichHistory,
    deleteRichHistory: jest.fn(),
    loadRichHistory: jest.fn(),
    onClose: jest.fn(),
  };

  Object.assign(props, propOverrides);

  return render(<RichHistoryContainer {...props} />);
};

describe('RichHistoryContainer', () => {
  it('should render component with correct width', () => {
    const { container } = setup();
    expect(container.firstElementChild!.getAttribute('style')).toContain('width: 531.5px');
  });
  it('should render component with correct height', () => {
    const { container } = setup();
    expect(container.firstElementChild!.getAttribute('style')).toContain('height: 400px');
  });
  it('should re-request rich history every time the component is mounted', () => {
    const loadRichHistory = jest.fn();
    const { unmount } = setup({ loadRichHistory });
    expect(loadRichHistory).toBeCalledTimes(1);

    unmount();
    expect(loadRichHistory).toBeCalledTimes(1);

    setup({ loadRichHistory });
    expect(loadRichHistory).toBeCalledTimes(2);
  });
});
