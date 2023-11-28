import { debounce, isNil } from 'lodash';
import React, { Component } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
export class UserPicker extends Component {
    constructor(props) {
        super(props);
        this.state = { isLoading: false };
        this.search = this.search.bind(this);
        this.debouncedSearch = debounce(this.search, 300, {
            leading: true,
            trailing: true,
        });
    }
    search(query) {
        this.setState({ isLoading: true });
        if (isNil(query)) {
            query = '';
        }
        return getBackendSrv()
            .get(`/api/org/users/lookup?query=${query}&limit=100`)
            .then((result) => {
            return result.map((user) => ({
                id: user.userId,
                value: user.userId,
                label: user.login,
                imgUrl: user.avatarUrl,
                login: user.login,
            }));
        })
            .finally(() => {
            this.setState({ isLoading: false });
        });
    }
    render() {
        const { className, onSelected, inputId } = this.props;
        const { isLoading } = this.state;
        return (React.createElement("div", { className: "user-picker", "data-testid": "userPicker" },
            React.createElement(AsyncSelect, { isClearable: true, className: className, inputId: inputId, isLoading: isLoading, defaultOptions: true, loadOptions: this.debouncedSearch, onChange: onSelected, placeholder: "Start typing to search for user", noOptionsMessage: "No users found", "aria-label": "User picker" })));
    }
}
//# sourceMappingURL=UserPicker.js.map