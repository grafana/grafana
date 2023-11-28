import { css } from '@emotion/css';
import classNames from 'classnames';
import React, { useState } from 'react';
import SVG from 'react-inlinesvg';
import { Icon, Spinner, TagList, useTheme2 } from '@grafana/ui';
import { getThumbnailURL } from './SearchCard';
export function SearchCardExpanded({ className, imageHeight, imageWidth, item, lastUpdated, onClick }) {
    var _a;
    const theme = useTheme2();
    const [hasImage, setHasImage] = useState(true);
    const imageSrc = getThumbnailURL(item.uid, theme.isLight);
    const styles = getStyles(theme, imageHeight, imageWidth);
    const folderTitle = item.parentTitle || 'General';
    return (React.createElement("a", { className: classNames(className, styles.card), key: item.uid, href: item.url, onClick: onClick },
        React.createElement("div", { className: styles.imageContainer }, hasImage ? (React.createElement("img", { loading: "lazy", alt: "Dashboard preview", className: styles.image, src: imageSrc, onLoad: () => setHasImage(true), onError: () => setHasImage(false) })) : (React.createElement("div", { className: styles.imagePlaceholder }, item.icon ? (React.createElement(SVG, { src: item.icon, width: 36, height: 36, title: item.title })) : (React.createElement(Icon, { name: "apps", size: "xl" }))))),
        React.createElement("div", { className: styles.info },
            React.createElement("div", { className: styles.infoHeader },
                React.createElement("div", { className: styles.titleContainer },
                    React.createElement("div", null, item.title),
                    React.createElement("div", { className: styles.folder },
                        React.createElement(Icon, { name: 'folder' }),
                        folderTitle)),
                lastUpdated !== null && (React.createElement("div", { className: styles.updateContainer },
                    React.createElement("div", null, "Last updated"),
                    lastUpdated ? React.createElement("div", { className: styles.update }, lastUpdated) : React.createElement(Spinner, null)))),
            React.createElement("div", null,
                React.createElement(TagList, { className: styles.tagList, tags: (_a = item.tags) !== null && _a !== void 0 ? _a : [] })))));
}
const getStyles = (theme, imageHeight, imageWidth) => {
    const IMAGE_HORIZONTAL_MARGIN = theme.spacing(4);
    return {
        card: css `
      background-color: ${theme.colors.background.secondary};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: 4px;
      box-shadow: ${theme.shadows.z3};
      display: flex;
      flex-direction: column;
      height: 100%;
      max-width: calc(${imageWidth}px + (${IMAGE_HORIZONTAL_MARGIN} * 2))};
      width: 100%;
    `,
        folder: css `
      align-items: center;
      color: ${theme.colors.text.secondary};
      display: flex;
      font-size: ${theme.typography.size.sm};
      gap: ${theme.spacing(0.5)};
    `,
        image: css `
      box-shadow: ${theme.shadows.z2};
      height: ${imageHeight}px;
      margin: ${theme.spacing(1)} calc(${IMAGE_HORIZONTAL_MARGIN} - 1px) 0;
      width: ${imageWidth}px;
    `,
        imageContainer: css `
      flex: 1;
      position: relative;

      &:after {
        background: linear-gradient(180deg, rgba(196, 196, 196, 0) 0%, rgba(127, 127, 127, 0.25) 100%);
        bottom: 0;
        content: '';
        left: 0;
        margin: ${theme.spacing(1)} calc(${IMAGE_HORIZONTAL_MARGIN} - 1px) 0;
        position: absolute;
        right: 0;
        top: 0;
      }
    `,
        imagePlaceholder: css `
      align-items: center;
      color: ${theme.colors.text.secondary};
      display: flex;
      height: ${imageHeight}px;
      justify-content: center;
      margin: ${theme.spacing(1)} ${IMAGE_HORIZONTAL_MARGIN} 0;
      width: ${imageWidth}px;
    `,
        info: css `
      background-color: ${theme.colors.background.canvas};
      border-bottom-left-radius: 4px;
      border-bottom-right-radius: 4px;
      display: flex;
      flex-direction: column;
      min-height: ${theme.spacing(7)};
      gap: ${theme.spacing(1)};
      padding: ${theme.spacing(1)} ${theme.spacing(2)};
      z-index: 1;
    `,
        infoHeader: css `
      display: flex;
      gap: ${theme.spacing(1)};
      justify-content: space-between;
    `,
        tagList: css `
      justify-content: flex-start;
    `,
        titleContainer: css `
      display: flex;
      flex-direction: column;
      gap: ${theme.spacing(0.5)};
    `,
        updateContainer: css `
      align-items: flex-end;
      display: flex;
      flex-direction: column;
      flex-shrink: 0;
      font-size: ${theme.typography.bodySmall.fontSize};
      gap: ${theme.spacing(0.5)};
    `,
        update: css `
      color: ${theme.colors.text.secondary};
      text-align: right;
    `,
    };
};
//# sourceMappingURL=SearchCardExpanded.js.map