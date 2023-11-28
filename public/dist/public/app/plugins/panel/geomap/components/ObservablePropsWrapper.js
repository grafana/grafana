import React, { Component } from 'react';
export class ObservablePropsWrapper extends Component {
    constructor(props) {
        super(props);
        this.state = {
            subProps: props.initialSubProps,
        };
    }
    componentDidMount() {
        this.sub = this.props.watch.subscribe({
            next: (subProps) => {
                this.setState({ subProps });
            },
            complete: () => { },
            error: (err) => { },
        });
    }
    componentWillUnmount() {
        if (this.sub) {
            this.sub.unsubscribe();
        }
    }
    render() {
        const { subProps } = this.state;
        return React.createElement(this.props.child, Object.assign({}, subProps));
    }
}
//# sourceMappingURL=ObservablePropsWrapper.js.map