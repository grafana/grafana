import { debounce, isNil } from 'lodash';
import React, { Component } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { AsyncSelect } from '@grafana/ui';
export class ServiceAccountPicker extends Component {
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
            .get(`/api/serviceaccounts/search`)
            .then((result) => {
            return result.serviceAccounts.map((sa) => ({
                id: sa.id,
                value: sa.id,
                label: sa.login,
                imgUrl: sa.avatarUrl,
                login: sa.login,
            }));
        })
            .finally(() => {
            this.setState({ isLoading: false });
        });
    }
    render() {
        const { className, onSelected, inputId } = this.props;
        const { isLoading } = this.state;
        return (React.createElement("div", { className: "service-account-picker", "data-testid": "serviceAccountPicker" },
            React.createElement(AsyncSelect, { isClearable: true, className: className, inputId: inputId, isLoading: isLoading, defaultOptions: true, loadOptions: this.debouncedSearch, onChange: onSelected, placeholder: "Start typing to search for service accounts", noOptionsMessage: "No service accounts found", "aria-label": "Service Account picker" })));
    }
}
//# sourceMappingURL=ServiceAccountPicker.js.map