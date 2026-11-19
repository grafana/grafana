import { render, screen } from '@testing-library/react';
import { cacheStore, clearElementCache } from 'react-inlinesvg';

import { Icon } from './Icon';
import { getIconPath } from './utils';

jest.mock('react-inlinesvg', () => jest.requireActual('../../../../../node_modules/react-inlinesvg'));

describe('Icon element caching', () => {
  beforeEach(() => {
    clearElementCache();
    cacheStore.set(getIconPath('heart', 'default'), {
      content: '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0h10v10z" /></svg>',
      status: 'loaded',
    });
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    clearElementCache();
    await cacheStore.clear();
  });

  it('reuses parsed icons across mounts while preserving instance sizes', () => {
    const parse = jest.spyOn(DOMParser.prototype, 'parseFromString');
    const { unmount } = render(<Icon name="heart" size="sm" />);
    expect(screen.getByTestId('icon-heart')).toHaveAttribute('width', '14');
    expect(screen.getByTestId('icon-heart').querySelector('path')).toHaveAttribute('d', 'M0 0h10v10z');
    unmount();

    render(<Icon name="heart" size="xl" />);
    expect(screen.getByTestId('icon-heart')).toHaveAttribute('width', '24');
    expect(screen.getByTestId('icon-heart').querySelector('path')).toHaveAttribute('d', 'M0 0h10v10z');
    expect(parse).toHaveBeenCalledTimes(1);
  });
});
