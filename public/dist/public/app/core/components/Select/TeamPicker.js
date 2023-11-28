import { debounce, isNil } from 'lodash';
import React, { Component } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
export class TeamPicker extends Component {
    constructor(props) {
        super(props);
        this.state = { isLoading: false };
        this.search = this.search.bind(this);
        this.debouncedSearch = debounce(this.search, 300, {
            leading: true,
            trailing: true,
        });
    }
    componentDidMount() {
        const { teamId } = this.props;
        if (!teamId) {
            return;
        }
        getBackendSrv()
            .get(`/api/teams/${teamId}`)
            .then((team) => {
            this.setState({
                value: {
                    value: team,
                    label: team.name,
                    imgUrl: team.avatarUrl,
                },
            });
        });
    }
    search(query) {
        this.setState({ isLoading: true });
        if (isNil(query)) {
            query = '';
        }
        return getBackendSrv()
            .get(`/api/teams/search?perpage=100&page=1&query=${query}`)
            .then((result) => {
            const teams = result.teams.map((team) => {
                return {
                    value: team,
                    label: team.name,
                    imgUrl: team.avatarUrl,
                };
            });
            this.setState({ isLoading: false });
            return teams;
        });
    }
    render() {
        const { onSelected, className } = this.props;
        const { isLoading, value } = this.state;
        return (React.createElement("div", { className: "user-picker", "data-testid": "teamPicker" },
            React.createElement(AsyncSelect, { isLoading: isLoading, defaultOptions: true, loadOptions: this.debouncedSearch, value: value, onChange: onSelected, className: className, placeholder: "Select a team", noOptionsMessage: "No teams found", "aria-label": "Team picker" })));
    }
}
//# sourceMappingURL=TeamPicker.js.map