import { Component } from 'react';
class PopoverController extends Component {
    constructor() {
        super(...arguments);
        this.hideTimeout = null;
        this.state = { show: false };
        this.showPopper = () => {
            if (this.hideTimeout) {
                clearTimeout(this.hideTimeout);
            }
            this.setState({ show: true });
        };
        this.hidePopper = () => {
            this.hideTimeout = setTimeout(() => {
                this.setState({ show: false });
            }, this.props.hideAfter);
        };
    }
    render() {
        const { children, content, placement = 'auto' } = this.props;
        const { show } = this.state;
        return children(this.showPopper, this.hidePopper, {
            show,
            placement,
            content,
        });
    }
}
export { PopoverController };
//# sourceMappingURL=PopoverController.js.map