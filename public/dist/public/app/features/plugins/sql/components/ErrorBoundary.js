import React from 'react';
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }
    static getDerivedStateFromError() {
        return { hasError: true };
    }
    render() {
        if (this.state.hasError) {
            const FallBack = this.props.fallBackComponent || React.createElement("div", null, "Error");
            return FallBack;
        }
        return this.props.children;
    }
}
//# sourceMappingURL=ErrorBoundary.js.map