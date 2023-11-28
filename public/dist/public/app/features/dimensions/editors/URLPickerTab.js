import { css } from '@emotion/css';
import React from 'react';
import { Field, Input, Label, useStyles2 } from '@grafana/ui';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';
import { getPublicOrAbsoluteUrl } from '../resource';
import { MediaType } from '../types';
export const URLPickerTab = (props) => {
    const { newValue, setNewValue, mediaType } = props;
    const styles = useStyles2(getStyles);
    const imgSrc = getPublicOrAbsoluteUrl(newValue);
    let shortName = newValue === null || newValue === void 0 ? void 0 : newValue.substring(newValue.lastIndexOf('/') + 1, newValue.lastIndexOf('.'));
    if (shortName.length > 20) {
        shortName = shortName.substring(0, 20) + '...';
    }
    return (React.createElement(React.Fragment, null,
        React.createElement(Field, null,
            React.createElement(Input, { onChange: (e) => setNewValue(e.currentTarget.value), value: newValue })),
        React.createElement("div", { className: styles.iconContainer },
            React.createElement(Field, { label: "Preview" },
                React.createElement("div", { className: styles.iconPreview },
                    mediaType === MediaType.Icon && React.createElement(SanitizedSVG, { src: imgSrc, className: styles.img }),
                    mediaType === MediaType.Image && newValue && (React.createElement("img", { src: imgSrc, alt: "Preview of the selected URL", className: styles.img })))),
            React.createElement(Label, null, shortName))));
};
const getStyles = (theme) => ({
    iconContainer: css `
    display: flex;
    flex-direction: column;
    width: 80%;
    align-items: center;
    align-self: center;
  `,
    iconPreview: css `
    width: 238px;
    height: 198px;
    border: 1px solid ${theme.colors.border.medium};
    display: flex;
    align-items: center;
    justify-content: center;
  `,
    img: css `
    width: 147px;
    height: 147px;
    fill: ${theme.colors.text.primary};
  `,
});
//# sourceMappingURL=URLPickerTab.js.map