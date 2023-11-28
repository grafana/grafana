import { css } from '@emotion/css';
import { chain } from 'lodash';
import pluralize from 'pluralize';
import React, { useState } from 'react';
import { Button, getTagColorsFromName, useStyles2 } from '@grafana/ui';
import { Label } from './Label';
export const AlertLabels = ({ labels, commonLabels = {}, size }) => {
    const styles = useStyles2(getStyles, size);
    const [showCommonLabels, setShowCommonLabels] = useState(false);
    const labelsToShow = chain(labels)
        .toPairs()
        .reject(isPrivateKey)
        .reject(([key]) => (showCommonLabels ? false : key in commonLabels))
        .value();
    const commonLabelsCount = Object.keys(commonLabels).length;
    const hasCommonLabels = commonLabelsCount > 0;
    return (React.createElement("div", { className: styles.wrapper, role: "list", "aria-label": "Labels" },
        labelsToShow.map(([label, value]) => (React.createElement(Label, { key: label + value, size: size, label: label, value: value, color: getLabelColor(label) }))),
        !showCommonLabels && hasCommonLabels && (React.createElement(Button, { variant: "secondary", fill: "text", onClick: () => setShowCommonLabels(true), tooltip: "Show common labels", tooltipPlacement: "top", size: "sm" },
            "+",
            commonLabelsCount,
            " common ",
            pluralize('label', commonLabelsCount))),
        showCommonLabels && hasCommonLabels && (React.createElement(Button, { variant: "secondary", fill: "text", onClick: () => setShowCommonLabels(false), tooltipPlacement: "top", size: "sm" }, "Hide common labels"))));
};
function getLabelColor(input) {
    return getTagColorsFromName(input).color;
}
const isPrivateKey = ([key, _]) => key.startsWith('__') && key.endsWith('__');
const getStyles = (theme, size) => ({
    wrapper: css `
    display: flex;
    flex-wrap: wrap;
    align-items: center;

    gap: ${size === 'md' ? theme.spacing() : theme.spacing(0.5)};
  `,
});
//# sourceMappingURL=AlertLabels.js.map