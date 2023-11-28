import { css, cx } from '@emotion/css';
import { cloneDeep } from 'lodash';
import React from 'react';
import { selectors } from '@grafana/e2e-selectors';
import { Tooltip, useStyles2 } from '@grafana/ui';
import { PanelRenderer } from '../PanelRenderer';
export function VisualizationSuggestionCard({ data, suggestion, onChange, width }) {
    var _a, _b, _c;
    const styles = useStyles2(getStyles);
    const { innerStyles, outerStyles, renderWidth, renderHeight } = getPreviewDimensionsAndStyles(width);
    const cardOptions = (_a = suggestion.cardOptions) !== null && _a !== void 0 ? _a : {};
    const commonButtonProps = {
        'aria-label': suggestion.name,
        className: styles.vizBox,
        'data-testid': selectors.components.VisualizationPreview.card(suggestion.name),
        style: outerStyles,
        onClick: () => {
            onChange({
                pluginId: suggestion.pluginId,
                options: suggestion.options,
                fieldConfig: suggestion.fieldConfig,
            });
        },
    };
    if (cardOptions.imgSrc) {
        return (React.createElement(Tooltip, { content: (_b = suggestion.description) !== null && _b !== void 0 ? _b : suggestion.name },
            React.createElement("button", Object.assign({}, commonButtonProps, { className: cx(styles.vizBox, styles.imgBox) }),
                React.createElement("div", { className: styles.name }, suggestion.name),
                React.createElement("img", { className: styles.img, src: cardOptions.imgSrc, alt: suggestion.name }))));
    }
    let preview = suggestion;
    if ((_c = suggestion.cardOptions) === null || _c === void 0 ? void 0 : _c.previewModifier) {
        preview = cloneDeep(suggestion);
        suggestion.cardOptions.previewModifier(preview);
    }
    return (React.createElement("button", Object.assign({}, commonButtonProps),
        React.createElement(Tooltip, { content: suggestion.name },
            React.createElement("div", { style: innerStyles, className: styles.renderContainer },
                React.createElement(PanelRenderer, { title: "", data: data, pluginId: suggestion.pluginId, width: renderWidth, height: renderHeight, options: preview.options, fieldConfig: preview.fieldConfig }),
                React.createElement("div", { className: styles.hoverPane })))));
}
const getStyles = (theme) => {
    return {
        hoverPane: css({
            position: 'absolute',
            top: 0,
            right: 0,
            left: 0,
            borderRadius: theme.spacing(2),
            bottom: 0,
        }),
        vizBox: css `
      position: relative;
      background: none;
      border-radius: ${theme.shape.radius.default};
      cursor: pointer;
      border: 1px solid ${theme.colors.border.medium};

      transition: ${theme.transitions.create(['background'], {
            duration: theme.transitions.duration.short,
        })};

      &:hover {
        background: ${theme.colors.background.secondary};
      }
    `,
        imgBox: css `
      display: flex;
      flex-direction: column;
      height: 100%;

      justify-self: center;
      color: ${theme.colors.text.primary};
      width: 100%;
      display: flex;

      justify-content: center;
      align-items: center;
      text-align: center;
    `,
        name: css `
      padding-bottom: ${theme.spacing(0.5)};
      margin-top: ${theme.spacing(-1)};
      font-size: ${theme.typography.bodySmall.fontSize};
      white-space: nowrap;
      overflow: hidden;
      color: ${theme.colors.text.secondary};
      font-weight: ${theme.typography.fontWeightMedium};
      text-overflow: ellipsis;
    `,
        img: css `
      max-width: ${theme.spacing(8)};
      max-height: ${theme.spacing(8)};
    `,
        renderContainer: css `
      position: absolute;
      transform-origin: left top;
      top: 6px;
      left: 6px;
    `,
    };
};
function getPreviewDimensionsAndStyles(width) {
    const aspectRatio = 16 / 10;
    const showWidth = width;
    const showHeight = width * (1 / aspectRatio);
    const renderWidth = 350;
    const renderHeight = renderWidth * (1 / aspectRatio);
    const padding = 6;
    const widthFactor = (showWidth - padding * 2) / renderWidth;
    const heightFactor = (showHeight - padding * 2) / renderHeight;
    return {
        renderHeight,
        renderWidth,
        outerStyles: { width: showWidth, height: showHeight },
        innerStyles: {
            width: renderWidth,
            height: renderHeight,
            transform: `scale(${widthFactor}, ${heightFactor})`,
        },
    };
}
//# sourceMappingURL=VisualizationSuggestionCard.js.map