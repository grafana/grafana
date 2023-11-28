import { css, cx } from '@emotion/css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { usePopper } from 'react-popper';
import { dateTimeFormat, FieldType, systemDateFormats, } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { FieldLinkList, Portal, useStyles2 } from '@grafana/ui';
import { ExemplarModalHeader } from '../../heatmap/ExemplarModalHeader';
export const ExemplarMarker = ({ timeZone, dataFrame, dataFrameFieldIndex, config, exemplarColor, clickedExemplarFieldIndex, setClickedExemplarFieldIndex, }) => {
    var _a;
    const styles = useStyles2(getExemplarMarkerStyles);
    const [isOpen, setIsOpen] = useState(false);
    const [isLocked, setIsLocked] = useState(false);
    const [markerElement, setMarkerElement] = React.useState(null);
    const [popperElement, setPopperElement] = React.useState(null);
    const { styles: popperStyles, attributes } = usePopper(markerElement, popperElement, {
        modifiers: [
            {
                name: 'preventOverflow',
                options: {
                    altAxis: true,
                },
            },
            {
                name: 'flip',
                options: {
                    fallbackPlacements: ['top', 'left-start'],
                },
            },
        ],
    });
    const popoverRenderTimeout = useRef();
    useEffect(() => {
        if (!((clickedExemplarFieldIndex === null || clickedExemplarFieldIndex === void 0 ? void 0 : clickedExemplarFieldIndex.fieldIndex) === dataFrameFieldIndex.fieldIndex &&
            (clickedExemplarFieldIndex === null || clickedExemplarFieldIndex === void 0 ? void 0 : clickedExemplarFieldIndex.frameIndex) === dataFrameFieldIndex.frameIndex)) {
            setIsLocked(false);
        }
    }, [clickedExemplarFieldIndex, dataFrameFieldIndex]);
    const getSymbol = () => {
        const symbols = [
            React.createElement("rect", { fill: exemplarColor, key: "diamond", x: "3.38672", width: "4.78985", height: "4.78985", transform: "rotate(45 3.38672 0)" }),
            React.createElement("path", { fill: exemplarColor, key: "x", d: "M1.94444 3.49988L0 5.44432L1.55552 6.99984L3.49996 5.05539L5.4444 6.99983L6.99992 5.44431L5.05548 3.49988L6.99983 1.55552L5.44431 0L3.49996 1.94436L1.5556 0L8.42584e-05 1.55552L1.94444 3.49988Z" }),
            React.createElement("path", { fill: exemplarColor, key: "triangle", d: "M4 0L7.4641 6H0.535898L4 0Z" }),
            React.createElement("rect", { fill: exemplarColor, key: "rectangle", width: "5", height: "5" }),
            React.createElement("path", { fill: exemplarColor, key: "pentagon", d: "M3 0.5L5.85317 2.57295L4.76336 5.92705H1.23664L0.146831 2.57295L3 0.5Z" }),
            React.createElement("path", { fill: exemplarColor, key: "plus", d: "m2.35672,4.2425l0,2.357l1.88558,0l0,-2.357l2.3572,0l0,-1.88558l-2.3572,0l0,-2.35692l-1.88558,0l0,2.35692l-2.35672,0l0,1.88558l2.35672,0z" }),
        ];
        return symbols[dataFrameFieldIndex.frameIndex % symbols.length];
    };
    const onMouseEnter = useCallback(() => {
        if (clickedExemplarFieldIndex === undefined) {
            if (popoverRenderTimeout.current) {
                clearTimeout(popoverRenderTimeout.current);
            }
            setIsOpen(true);
        }
    }, [setIsOpen, clickedExemplarFieldIndex]);
    const lockExemplarModal = () => {
        setIsLocked(true);
    };
    const onMouseLeave = useCallback(() => {
        popoverRenderTimeout.current = setTimeout(() => {
            setIsOpen(false);
        }, 150);
    }, [setIsOpen]);
    const renderMarker = useCallback(() => {
        //Put fields with links on the top
        const fieldsWithLinks = dataFrame.fields.filter((field) => { var _a, _b; return ((_a = field.config.links) === null || _a === void 0 ? void 0 : _a.length) && ((_b = field.config.links) === null || _b === void 0 ? void 0 : _b.length) > 0; }) || [];
        const orderedDataFrameFields = [
            ...fieldsWithLinks,
            ...dataFrame.fields.filter((field) => !fieldsWithLinks.includes(field)),
        ];
        const timeFormatter = (value) => {
            return dateTimeFormat(value, {
                format: systemDateFormats.fullDate,
                timeZone,
            });
        };
        const onClose = () => {
            setIsLocked(false);
            setIsOpen(false);
            setClickedExemplarFieldIndex(undefined);
        };
        return (React.createElement("div", Object.assign({ onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, className: styles.tooltip, ref: setPopperElement, style: popperStyles.popper }, attributes.popper),
            React.createElement("div", { className: styles.wrapper },
                isLocked && React.createElement(ExemplarModalHeader, { onClick: onClose }),
                React.createElement("div", { className: styles.body },
                    React.createElement("div", { className: styles.header },
                        React.createElement("span", { className: styles.title }, "Exemplars")),
                    React.createElement("div", null,
                        React.createElement("table", { className: styles.exemplarsTable },
                            React.createElement("tbody", null, orderedDataFrameFields.map((field, i) => {
                                var _a, _b;
                                const value = field.values[dataFrameFieldIndex.fieldIndex];
                                const links = ((_a = field.config.links) === null || _a === void 0 ? void 0 : _a.length)
                                    ? (_b = field.getLinks) === null || _b === void 0 ? void 0 : _b.call(field, { valueRowIndex: dataFrameFieldIndex.fieldIndex })
                                    : undefined;
                                return (React.createElement("tr", { key: i },
                                    React.createElement("td", { valign: "top" }, field.name),
                                    React.createElement("td", null,
                                        React.createElement("div", { className: styles.valueWrapper },
                                            React.createElement("span", null, field.type === FieldType.time ? timeFormatter(value) : value),
                                            links && React.createElement(FieldLinkList, { links: links })))));
                            }))))))));
    }, [
        attributes.popper,
        dataFrame.fields,
        dataFrameFieldIndex,
        onMouseEnter,
        onMouseLeave,
        popperStyles.popper,
        styles,
        timeZone,
        isLocked,
        setClickedExemplarFieldIndex,
    ]);
    const seriesColor = (_a = config
        .getSeries()
        .find((s) => { var _a; return ((_a = s.props.dataFrameFieldIndex) === null || _a === void 0 ? void 0 : _a.frameIndex) === dataFrameFieldIndex.frameIndex; })) === null || _a === void 0 ? void 0 : _a.props.lineColor;
    const onExemplarClick = () => {
        setClickedExemplarFieldIndex(dataFrameFieldIndex);
        lockExemplarModal();
    };
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { ref: setMarkerElement, onClick: onExemplarClick, onKeyDown: (e) => {
                if (e.key === 'Enter') {
                    onExemplarClick();
                }
            }, onMouseEnter: onMouseEnter, onMouseLeave: onMouseLeave, className: styles.markerWrapper, "aria-label": selectors.components.DataSource.Prometheus.exemplarMarker, role: "button", tabIndex: 0 },
            React.createElement("svg", { viewBox: "0 0 7 7", width: "7", height: "7", style: { fill: seriesColor }, className: cx(styles.marble, (isOpen || isLocked) && styles.activeMarble) }, getSymbol())),
        (isOpen || isLocked) && React.createElement(Portal, null, renderMarker())));
};
const getExemplarMarkerStyles = (theme) => {
    const bg = theme.isDark ? theme.v1.palette.dark2 : theme.v1.palette.white;
    const headerBg = theme.isDark ? theme.v1.palette.dark9 : theme.v1.palette.gray5;
    const shadowColor = theme.isDark ? theme.v1.palette.black : theme.v1.palette.white;
    const tableBgOdd = theme.isDark ? theme.v1.palette.dark3 : theme.v1.palette.gray6;
    return {
        markerWrapper: css `
      padding: 0 4px 4px 4px;
      width: 8px;
      height: 8px;
      box-sizing: content-box;
      transform: translate3d(-50%, 0, 0);

      &:hover {
        > svg {
          transform: scale(1.3);
          opacity: 1;
          filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));
        }
      }
    `,
        marker: css `
      width: 0;
      height: 0;
      border-left: 4px solid transparent;
      border-right: 4px solid transparent;
      border-bottom: 4px solid ${theme.v1.palette.red};
      pointer-events: none;
    `,
        wrapper: css `
      background: ${bg};
      border: 1px solid ${headerBg};
      border-radius: ${theme.shape.borderRadius(2)};
      box-shadow: 0 0 20px ${shadowColor};
      padding: ${theme.spacing(1)};
    `,
        exemplarsTable: css `
      width: 100%;

      tr td {
        padding: 5px 10px;
        white-space: nowrap;
        border-bottom: 4px solid ${theme.components.panel.background};
      }

      tr {
        background-color: ${theme.colors.background.primary};

        &:nth-child(even) {
          background-color: ${tableBgOdd};
        }
      }
    `,
        valueWrapper: css `
      display: flex;
      flex-direction: row;
      flex-wrap: wrap;
      column-gap: ${theme.spacing(1)};

      > span {
        flex-grow: 0;
      }

      > * {
        flex: 1 1;
        align-self: center;
      }
    `,
        tooltip: css `
      background: none;
      padding: 0;
      overflow-y: auto;
      max-height: 95vh;
    `,
        header: css `
      background: ${headerBg};
      padding: 6px 10px;
      display: flex;
    `,
        title: css `
      font-weight: ${theme.typography.fontWeightMedium};
      padding-right: ${theme.spacing(2)};
      overflow: hidden;
      display: inline-block;
      white-space: nowrap;
      text-overflow: ellipsis;
      flex-grow: 1;
    `,
        body: css `
      font-weight: ${theme.typography.fontWeightMedium};
      border-radius: ${theme.shape.borderRadius(2)};
      overflow: hidden;
    `,
        marble: css `
      display: block;
      opacity: 0.5;
      transition: transform 0.15s ease-out;
    `,
        activeMarble: css `
      transform: scale(1.3);
      opacity: 1;
      filter: drop-shadow(0 0 8px rgba(0, 0, 0, 0.5));
    `,
    };
};
//# sourceMappingURL=ExemplarMarker.js.map