import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React, { useCallback, useRef, useState } from 'react';
import SVG from 'react-inlinesvg';
import { usePopper } from 'react-popper';
import { selectors } from '@grafana/e2e-selectors';
import { Icon, Portal, TagList, useTheme2 } from '@grafana/ui';
import { backendSrv } from 'app/core/services/backend_srv';
import { SearchCardExpanded } from './SearchCardExpanded';
import { SearchCheckbox } from './SearchCheckbox';
const DELAY_BEFORE_EXPANDING = 500;
export function getThumbnailURL(uid, isLight) {
    return `/api/dashboards/uid/${uid}/img/thumb/${isLight ? 'light' : 'dark'}`;
}
export function SearchCard({ editable, item, isSelected, onTagSelected, onToggleChecked, onClick }) {
    var _a;
    const [hasImage, setHasImage] = useState(true);
    const [lastUpdated, setLastUpdated] = useState(null);
    const [showExpandedView, setShowExpandedView] = useState(false);
    const timeout = useRef(null);
    // Popper specific logic
    const offsetCallback = useCallback(({ placement, reference, popper }) => {
        let result = [0, 0];
        if (placement === 'bottom' || placement === 'top') {
            result = [0, -(reference.height + popper.height) / 2];
        }
        else if (placement === 'left' || placement === 'right') {
            result = [-(reference.width + popper.width) / 2, 0];
        }
        return result;
    }, []);
    const [markerElement, setMarkerElement] = React.useState(null);
    const [popperElement, setPopperElement] = React.useState(null);
    const { styles: popperStyles, attributes } = usePopper(markerElement, popperElement, {
        modifiers: [
            {
                name: 'offset',
                options: {
                    offset: offsetCallback,
                },
            },
        ],
    });
    const theme = useTheme2();
    const imageSrc = getThumbnailURL(item.uid, theme.isLight);
    const styles = getStyles(theme, markerElement === null || markerElement === void 0 ? void 0 : markerElement.getBoundingClientRect().width, popperElement === null || popperElement === void 0 ? void 0 : popperElement.getBoundingClientRect().width);
    const onShowExpandedView = () => __awaiter(this, void 0, void 0, function* () {
        setShowExpandedView(true);
        if (item.uid && !lastUpdated) {
            const dashboard = yield backendSrv.getDashboardByUid(item.uid);
            const { updated } = dashboard.meta;
            if (updated) {
                setLastUpdated(new Date(updated).toLocaleString());
            }
            else {
                setLastUpdated(null);
            }
        }
    });
    const onMouseEnter = () => {
        timeout.current = window.setTimeout(onShowExpandedView, DELAY_BEFORE_EXPANDING);
    };
    const onMouseMove = () => {
        if (timeout.current) {
            window.clearTimeout(timeout.current);
        }
        timeout.current = window.setTimeout(onShowExpandedView, DELAY_BEFORE_EXPANDING);
    };
    const onMouseLeave = () => {
        if (timeout.current) {
            window.clearTimeout(timeout.current);
        }
        setShowExpandedView(false);
    };
    const onCheckboxClick = (ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        onToggleChecked === null || onToggleChecked === void 0 ? void 0 : onToggleChecked(item);
    };
    const onTagClick = (tag, ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        onTagSelected === null || onTagSelected === void 0 ? void 0 : onTagSelected(tag);
    };
    return (React.createElement("a", { "data-testid": selectors.components.Search.dashboardCard(item.title), className: styles.card, key: item.uid, href: item.url, ref: (ref) => setMarkerElement(ref), onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, onMouseMove: onMouseMove, onClick: onClick },
        React.createElement("div", { className: styles.imageContainer },
            React.createElement(SearchCheckbox, { className: styles.checkbox, "aria-label": `Select dashboard ${item.title}`, editable: editable, checked: isSelected, onClick: onCheckboxClick }),
            hasImage ? (React.createElement("img", { loading: "lazy", className: styles.image, src: imageSrc, alt: "Dashboard preview", onError: () => setHasImage(false) })) : (React.createElement("div", { className: styles.imagePlaceholder }, item.icon ? (React.createElement(SVG, { src: item.icon, width: 36, height: 36, title: item.title })) : (React.createElement(Icon, { name: "apps", size: "xl" }))))),
        React.createElement("div", { className: styles.info },
            React.createElement("div", { className: styles.title }, item.title),
            React.createElement(TagList, { displayMax: 1, tags: (_a = item.tags) !== null && _a !== void 0 ? _a : [], onClick: onTagClick })),
        showExpandedView && (React.createElement(Portal, { className: styles.portal },
            React.createElement("div", Object.assign({ ref: setPopperElement, style: popperStyles.popper }, attributes.popper),
                React.createElement(SearchCardExpanded, { className: styles.expandedView, imageHeight: 240, imageWidth: 320, item: item, lastUpdated: lastUpdated, onClick: onClick }))))));
}
const getStyles = (theme, markerWidth = 0, popperWidth = 0) => {
    const IMAGE_HORIZONTAL_MARGIN = theme.spacing(4);
    return {
        card: css `
      background-color: ${theme.colors.background.secondary};
      border: 1px solid ${theme.colors.border.medium};
      border-radius: ${theme.shape.radius.default};
      display: flex;
      flex-direction: column;

      &:hover {
        background-color: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
      }
    `,
        checkbox: css `
      left: 0;
      margin: ${theme.spacing(1)};
      position: absolute;
      top: 0;
    `,
        expandedView: css `
      @keyframes expand {
        0% {
          transform: scale(${markerWidth / popperWidth});
        }
        100% {
          transform: scale(1);
        }
      }

      animation: expand ${theme.transitions.duration.shortest}ms ease-in-out 0s 1 normal;
      background-color: ${theme.colors.emphasize(theme.colors.background.secondary, 0.03)};
    `,
        image: css `
      aspect-ratio: 4 / 3;
      box-shadow: ${theme.shadows.z1};
      margin: ${theme.spacing(1)} ${IMAGE_HORIZONTAL_MARGIN} 0;
      width: calc(100% - (2 * ${IMAGE_HORIZONTAL_MARGIN}));
    `,
        imageContainer: css `
      flex: 1;
      position: relative;

      &:after {
        background: linear-gradient(180deg, rgba(196, 196, 196, 0) 0%, rgba(127, 127, 127, 0.25) 100%);
        bottom: 0;
        content: '';
        left: 0;
        margin: ${theme.spacing(1)} ${IMAGE_HORIZONTAL_MARGIN} 0;
        position: absolute;
        right: 0;
        top: 0;
      }
    `,
        imagePlaceholder: css `
      align-items: center;
      aspect-ratio: 4 / 3;
      color: ${theme.colors.text.secondary};
      display: flex;
      justify-content: center;
      margin: ${theme.spacing(1)} ${IMAGE_HORIZONTAL_MARGIN} 0;
      width: calc(100% - (2 * ${IMAGE_HORIZONTAL_MARGIN}));
    `,
        info: css `
      align-items: center;
      background-color: ${theme.colors.background.canvas};
      border-bottom-left-radius: ${theme.shape.radius.default};
      border-bottom-right-radius: ${theme.shape.radius.default};
      display: flex;
      height: ${theme.spacing(7)};
      gap: ${theme.spacing(1)};
      padding: 0 ${theme.spacing(2)};
      z-index: 1;
    `,
        portal: css `
      pointer-events: none;
    `,
        title: css `
      display: block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    `,
    };
};
//# sourceMappingURL=SearchCard.js.map