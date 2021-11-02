import { __assign, __makeTemplateObject, __rest } from "tslib";
import React from 'react';
import { InfoBox } from './InfoBox';
import { FeatureState } from '@grafana/data';
import { stylesFactory, useStyles } from '../../themes';
import { Badge } from '../Badge/Badge';
import { css } from '@emotion/css';
/** @deprecated use Alert with severity info */
export var FeatureInfoBox = React.memo(React.forwardRef(function (_a, ref) {
    var title = _a.title, featureState = _a.featureState, otherProps = __rest(_a, ["title", "featureState"]);
    var styles = useStyles(getFeatureInfoBoxStyles);
    var titleEl = featureState ? (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.badge },
            React.createElement(FeatureBadge, { featureState: featureState })),
        React.createElement("h3", null, title))) : (React.createElement("h3", null, title));
    return React.createElement(InfoBox, __assign({ branded: true, title: titleEl, urlTitle: "Read documentation", ref: ref }, otherProps));
}));
FeatureInfoBox.displayName = 'FeatureInfoBox';
var getFeatureInfoBoxStyles = stylesFactory(function (theme) {
    return {
        badge: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      margin-bottom: ", ";\n    "], ["\n      margin-bottom: ", ";\n    "])), theme.spacing.sm),
    };
});
export var FeatureBadge = function (_a) {
    var featureState = _a.featureState, tooltip = _a.tooltip;
    var display = getPanelStateBadgeDisplayModel(featureState);
    return React.createElement(Badge, { text: display.text, color: display.color, icon: display.icon, tooltip: tooltip });
};
function getPanelStateBadgeDisplayModel(featureState) {
    switch (featureState) {
        case FeatureState.alpha:
            return {
                text: 'Alpha',
                icon: 'exclamation-triangle',
                color: 'orange',
            };
    }
    return {
        text: 'Beta',
        icon: 'rocket',
        color: 'blue',
    };
}
var templateObject_1;
//# sourceMappingURL=FeatureInfoBox.js.map