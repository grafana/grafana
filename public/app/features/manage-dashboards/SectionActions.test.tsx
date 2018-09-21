import React from 'react';
import { shallow } from 'enzyme';
import appEvents from '../../core/app_events';
import { Props, SectionActions } from './SectionActions';
import { getMockSectionItems } from './__mocks__/manageDashboardMock';

jest.mock('../../core/app_events', () => ({
  emit: jest.fn(),
}));

const setup = (propOverrides?: object) => {
  const props: Props = {
    canMove: false,
    canDelete: false,
    selectedTagFilter: '',
    setSectionsAndItemsSelected: jest.fn(),
    allChecked: false,
    tagFilterOptions: [],
    toggleStarredFilter: jest.fn(),
    addTagFilter: jest.fn(),
    filterOnStarred: false,
    selectedDashboards: [] as string[],
    selectedFoldersAndDashboards: {} as { folders: string[]; dashboards: string[] },
    loadSections: jest.fn(),
    deleteFoldersAndDashboards: jest.fn(),
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<SectionActions {...props} />);
  const instance = wrapper.instance() as SectionActions;

  return {
    wrapper,
    instance,
  };
};

describe('Render', () => {
  it('should render component', () => {
    const { wrapper } = setup();

    expect(wrapper).toMatchSnapshot();
  });

  it('should render tag filter options', () => {
    const { wrapper } = setup({
      tagFilterOptions: [
        {
          term: 'mysql',
          count: 1,
        },
        {
          term: 'nosql',
          count: 5,
        },
      ],
    });

    expect(wrapper).toMatchSnapshot();
  });

  it('should render move and delete buttons', () => {
    const { wrapper } = setup({
      canMove: true,
      canDelete: true,
    });

    expect(wrapper).toMatchSnapshot();
  });
});

describe('Functions', () => {
  it('should select all', () => {
    const { instance } = setup();

    instance.onSelectAllChanged();

    expect(instance.props.setSectionsAndItemsSelected).toHaveBeenCalledWith(true);
  });

  it('should toggle starred filter', () => {
    const { instance } = setup();

    instance.onStarredFilterChange();

    expect(instance.props.toggleStarredFilter).toHaveBeenCalledWith(true);
  });

  it('should add tag filter', () => {
    const { instance } = setup();
    const mockEvent = { target: { value: 'mysql' } };

    instance.onTagFilterChange(mockEvent);

    expect(instance.props.addTagFilter).toHaveBeenCalledWith('mysql');
  });

  describe('Move selected dashboards', () => {
    const mockSelectedDashboards = getMockSectionItems(5);
    mockSelectedDashboards[0].checked = true;
    mockSelectedDashboards[1].checked = true;

    const { instance } = setup({
      selectedDashboards: mockSelectedDashboards,
    });

    it('should emit open modal event', () => {
      instance.moveSelectedDashboards();

      expect(appEvents.emit).toHaveBeenCalled();
    });
  });

  describe('delete selected folders and dashboards', () => {
    const { instance } = setup({
      selectedFoldersAndDashboards: {
        folders: ['folder-1'],
        dashboards: ['dashboard-1', 'dashboard-2', 'dashboard-3'],
      },
    });

    it('should emit open modal event', () => {
      instance.delete();

      expect(appEvents.emit).toHaveBeenCalled();
    });
  });
});
