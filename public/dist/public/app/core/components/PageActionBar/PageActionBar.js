import React, { PureComponent } from 'react';
import { LinkButton, FilterInput, InlineField } from '@grafana/ui';
import { SortPicker } from '../Select/SortPicker';
export default class PageActionBar extends PureComponent {
    render() {
        const { searchQuery, linkButton, setSearchQuery, target, placeholder = 'Search by name or type', sortPicker, } = this.props;
        const linkProps = { href: linkButton === null || linkButton === void 0 ? void 0 : linkButton.href, disabled: linkButton === null || linkButton === void 0 ? void 0 : linkButton.disabled };
        if (target) {
            linkProps.target = target;
        }
        return (React.createElement("div", { className: "page-action-bar" },
            React.createElement(InlineField, { grow: true },
                React.createElement(FilterInput, { value: searchQuery, onChange: setSearchQuery, placeholder: placeholder })),
            sortPicker && (React.createElement(SortPicker, { onChange: sortPicker.onChange, value: sortPicker.value, getSortOptions: sortPicker.getSortOptions })),
            linkButton && React.createElement(LinkButton, Object.assign({}, linkProps), linkButton.title)));
    }
}
//# sourceMappingURL=PageActionBar.js.map