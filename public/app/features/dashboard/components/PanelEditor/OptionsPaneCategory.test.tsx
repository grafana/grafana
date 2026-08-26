import { screen } from '@testing-library/react';
import { render } from 'test/test-utils';

import { mockLocalStorage } from 'app/features/alerting/unified/mocks';

import { OptionsPaneCategory, type OptionsPaneCategoryProps } from './OptionsPaneCategory';

const childText = 'Category body content';
const categoryId = 'test-category';

const localStorageMock = mockLocalStorage();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
  writable: true,
});

function setup(props: Partial<OptionsPaneCategoryProps> = {}) {
  return render(
    <OptionsPaneCategory id={categoryId} title="Test category" itemsCount={1} {...props}>
      <div>{childText}</div>
    </OptionsPaneCategory>
  );
}

function setLocalStorageState(isExpanded: boolean, id = categoryId) {
  localStorageMock.setItem(`grafana.dashboard.editor.ui.optionGroup[${id}]`, JSON.stringify({ isExpanded }));
}

describe('OptionsPaneCategory', () => {
  afterEach(() => {
    window.localStorage.clear();
  });

  describe('initial expanded state', () => {
    it('is expanded when it has items and is open by default', () => {
      setup({ itemsCount: 3, isOpenDefault: true });
      expect(screen.getByText(childText)).toBeInTheDocument();
    });

    it('is collapsed when there are explicitly no items, even when open by default', () => {
      setup({ itemsCount: 0, isOpenDefault: true });
      expect(screen.queryByText(childText)).not.toBeInTheDocument();
    });

    it('does not force collapse when the item count is unknown', () => {
      setup({ itemsCount: undefined, isOpenDefault: true });
      expect(screen.getByText(childText)).toBeInTheDocument();
    });

    it('is collapsed when not open by default, even when it has items', () => {
      setup({ itemsCount: 3, isOpenDefault: false });
      expect(screen.queryByText(childText)).not.toBeInTheDocument();
    });

    it('is expanded when forced open, even with no items', () => {
      setup({ itemsCount: 0, forceOpen: true });
      expect(screen.getByText(childText)).toBeInTheDocument();
    });
  });

  describe('saved state from localStorage', () => {
    it('collapses when saved state is collapsed, overriding isOpenDefault', () => {
      setLocalStorageState(false);
      setup({ itemsCount: 3, isOpenDefault: true });
      expect(screen.queryByText(childText)).not.toBeInTheDocument();
    });

    it('expands when saved state is expanded, overriding isOpenDefault', () => {
      setLocalStorageState(true);
      setup({ itemsCount: 3, isOpenDefault: false });
      expect(screen.getByText(childText)).toBeInTheDocument();
    });

    it('stays collapsed when there are no items, even if saved state is expanded', () => {
      setLocalStorageState(true);
      setup({ itemsCount: 0, isOpenDefault: true });
      expect(screen.queryByText(childText)).not.toBeInTheDocument();
    });
  });
});
