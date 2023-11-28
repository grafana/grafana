import { css } from '@emotion/css';
import { transform } from 'ol/proj';
import React, { PureComponent } from 'react';
import tinycolor from 'tinycolor2';
import { selectors } from '@grafana/e2e-selectors/src';
import { config } from 'app/core/config';
export class DebugOverlay extends PureComponent {
    constructor(props) {
        super(props);
        this.style = getStyles(config.theme2);
        this.updateViewState = () => {
            const view = this.props.map.getView();
            this.setState({
                zoom: view.getZoom(),
                center: transform(view.getCenter(), view.getProjection(), 'EPSG:4326'),
            });
        };
        this.state = { zoom: 0, center: [0, 0] };
    }
    componentDidMount() {
        this.props.map.on('moveend', this.updateViewState);
        this.updateViewState();
    }
    render() {
        const { zoom, center } = this.state;
        return (React.createElement("div", { className: this.style.infoWrap, "aria-label": selectors.components.DebugOverlay.wrapper },
            React.createElement("table", null,
                React.createElement("tbody", null,
                    React.createElement("tr", null,
                        React.createElement("th", null, "Zoom:"),
                        React.createElement("td", null, zoom === null || zoom === void 0 ? void 0 : zoom.toFixed(1))),
                    React.createElement("tr", null,
                        React.createElement("th", null, "Center:\u00A0"),
                        React.createElement("td", null,
                            center[0].toFixed(5),
                            ", ",
                            center[1].toFixed(5)))))));
    }
}
const getStyles = (theme) => ({
    infoWrap: css({
        color: theme.colors.text.primary,
        background: tinycolor(theme.components.panel.background).setAlpha(0.7).toString(),
        borderRadius: theme.shape.radius.default,
        padding: theme.spacing(1),
    }),
});
//# sourceMappingURL=DebugOverlay.js.map