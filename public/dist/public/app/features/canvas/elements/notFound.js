import React, { PureComponent } from 'react';
class NotFoundDisplay extends PureComponent {
    render() {
        const { config } = this.props;
        return (React.createElement("div", null,
            React.createElement("h3", null, "NOT FOUND:"),
            React.createElement("pre", null, JSON.stringify(config, null, 2))));
    }
}
export const notFoundItem = {
    id: 'not-found',
    name: 'Not found',
    description: 'Display when element type is not found in the registry',
    display: NotFoundDisplay,
    defaultSize: {
        width: 100,
        height: 100,
    },
    getNewOptions: () => ({
        config: {},
    }),
};
//# sourceMappingURL=notFound.js.map