import React from 'react';
import { shallow } from 'enzyme';
import { Props, TeamList } from './TeamList';
import { OrgRole, Team } from '../../types';
import { getMockTeam, getMultipleMockTeams } from './__mocks__/teamMocks';
import { User } from 'app/core/services/context_srv';
import { NavModel } from '@grafana/data';
import { mockToolkitActionCreator } from 'test/core/redux/mocks';
import { setSearchQuery } from './state/reducers';

const setup = (propOverrides?: object) => {
  const props: Props = {
    navModel: {
      main: {
        text: 'Configuration',
      },
      node: {
        text: 'Team List',
      },
    } as NavModel,
    teams: [] as Team[],
    loadTeams: jest.fn(),
    deleteTeam: jest.fn(),
    setSearchQuery: mockToolkitActionCreator(setSearchQuery),
    searchQuery: '',
    teamsCount: 0,
    hasFetched: false,
    editorsCanAdmin: false,
    signedInUser: {
      id: 1,
      orgRole: OrgRole.Viewer,
    } as User,
  };

  Object.assign(props, propOverrides);

  const wrapper = shallow(<TeamList {...props} />);
  const instance = wrapper.instance() as TeamList;

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

  it('should render teams table', () => {
    const { wrapper } = setup({
      teams: getMultipleMockTeams(5),
      teamsCount: 5,
      hasFetched: true,
    });

    expect(wrapper).toMatchSnapshot();
  });

  describe('when feature toggle editorsCanAdmin is turned on', () => {
    describe('and signedin user is not viewer', () => {
      it('should enable the new team button', () => {
        const { wrapper } = setup({
          teams: getMultipleMockTeams(1),
          teamsCount: 1,
          hasFetched: true,
          editorsCanAdmin: true,
          signedInUser: {
            id: 1,
            orgRole: OrgRole.Editor,
          } as User,
        });

        expect(wrapper).toMatchSnapshot();
      });
    });

    describe('and signedin user is a viewer', () => {
      it('should disable the new team button', () => {
        const { wrapper } = setup({
          teams: getMultipleMockTeams(1),
          teamsCount: 1,
          hasFetched: true,
          editorsCanAdmin: true,
          signedInUser: {
            id: 1,
            orgRole: OrgRole.Viewer,
          } as User,
        });

        expect(wrapper).toMatchSnapshot();
      });
    });
  });
});

describe('Life cycle', () => {
  it('should call loadTeams', () => {
    const { instance } = setup();

    instance.componentDidMount();

    expect(instance.props.loadTeams).toHaveBeenCalled();
  });
});

describe('Functions', () => {
  describe('Delete team', () => {
    it('should call delete team', () => {
      const { instance } = setup();
      instance.deleteTeam(getMockTeam());

      expect(instance.props.deleteTeam).toHaveBeenCalledWith(1);
    });
  });

  describe('on search query change', () => {
    it('should call setSearchQuery', () => {
      const { instance } = setup();

      instance.onSearchQueryChange('test');

      expect(instance.props.setSearchQuery).toHaveBeenCalledWith('test');
    });
  });
});
