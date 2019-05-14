import * as tslib_1 from "tslib";
import React from 'react';
import { shallow } from 'enzyme';
import { TeamList } from './TeamList';
import { getMockTeam, getMultipleMockTeams } from './__mocks__/teamMocks';
var setup = function (propOverrides) {
    var props = {
        navModel: {
            main: {
                text: 'Configuration',
            },
            node: {
                text: 'Team List',
            },
        },
        teams: [],
        loadTeams: jest.fn(),
        deleteTeam: jest.fn(),
        setSearchQuery: jest.fn(),
        searchQuery: '',
        teamsCount: 0,
        hasFetched: false,
    };
    Object.assign(props, propOverrides);
    var wrapper = shallow(React.createElement(TeamList, tslib_1.__assign({}, props)));
    var instance = wrapper.instance();
    return {
        wrapper: wrapper,
        instance: instance,
    };
};
describe('Render', function () {
    it('should render component', function () {
        var wrapper = setup().wrapper;
        expect(wrapper).toMatchSnapshot();
    });
    it('should render teams table', function () {
        var wrapper = setup({
            teams: getMultipleMockTeams(5),
            teamsCount: 5,
            hasFetched: true,
        }).wrapper;
        expect(wrapper).toMatchSnapshot();
    });
});
describe('Life cycle', function () {
    it('should call loadTeams', function () {
        var instance = setup().instance;
        instance.componentDidMount();
        expect(instance.props.loadTeams).toHaveBeenCalled();
    });
});
describe('Functions', function () {
    describe('Delete team', function () {
        it('should call delete team', function () {
            var instance = setup().instance;
            instance.deleteTeam(getMockTeam());
            expect(instance.props.deleteTeam).toHaveBeenCalledWith(1);
        });
    });
    describe('on search query change', function () {
        it('should call setSearchQuery', function () {
            var instance = setup().instance;
            instance.onSearchQueryChange('test');
            expect(instance.props.setSearchQuery).toHaveBeenCalledWith('test');
        });
    });
});
//# sourceMappingURL=TeamList.test.js.map