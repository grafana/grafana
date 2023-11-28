import React, { useCallback } from 'react';
import { ClipboardButton, IconButton } from '@grafana/ui';
export const LogRowMenuCell = React.memo(({ logText, onOpenContext, onPermalinkClick, onPinLine, onUnpinLine, pinned, row, showContextToggle, styles, mouseIsOver, onBlur, }) => {
    const shouldShowContextToggle = showContextToggle ? showContextToggle(row) : false;
    const onLogRowClick = useCallback((e) => {
        e.stopPropagation();
    }, []);
    const onShowContextClick = useCallback((e) => {
        e.stopPropagation();
        onOpenContext(row);
    }, [onOpenContext, row]);
    /**
     * For better accessibility support, we listen to the onBlur event here (to hide this component), and
     * to onFocus in LogRow (to show this component).
     */
    const handleBlur = useCallback((e) => {
        if (!e.currentTarget.contains(e.relatedTarget) && onBlur) {
            onBlur();
        }
    }, [onBlur]);
    const getLogText = useCallback(() => logText, [logText]);
    return (
    // We keep this click listener here to prevent the row from being selected when clicking on the menu.
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    React.createElement("span", { className: `log-row-menu ${styles.rowMenu}`, onClick: onLogRowClick, onBlur: handleBlur },
        pinned && !mouseIsOver && (React.createElement(IconButton, { className: styles.unPinButton, size: "md", name: "gf-pin", onClick: () => onUnpinLine && onUnpinLine(row), tooltip: "Unpin line", tooltipPlacement: "top", "aria-label": "Unpin line", tabIndex: 0 })),
        mouseIsOver && (React.createElement(React.Fragment, null,
            shouldShowContextToggle && (React.createElement(IconButton, { size: "md", name: "gf-show-context", onClick: onShowContextClick, tooltip: "Show context", tooltipPlacement: "top", "aria-label": "Show context", tabIndex: 0 })),
            React.createElement(ClipboardButton, { className: styles.copyLogButton, icon: "copy", variant: "secondary", fill: "text", size: "md", getText: getLogText, tooltip: "Copy to clipboard", tooltipPlacement: "top", tabIndex: 0 }),
            pinned && onUnpinLine && (React.createElement(IconButton, { className: styles.unPinButton, size: "md", name: "gf-pin", onClick: () => onUnpinLine && onUnpinLine(row), tooltip: "Unpin line", tooltipPlacement: "top", "aria-label": "Unpin line", tabIndex: 0 })),
            !pinned && onPinLine && (React.createElement(IconButton, { className: styles.unPinButton, size: "md", name: "gf-pin", onClick: () => onPinLine && onPinLine(row), tooltip: "Pin line", tooltipPlacement: "top", "aria-label": "Pin line", tabIndex: 0 })),
            onPermalinkClick && row.rowId !== undefined && row.uid && (React.createElement(IconButton, { tooltip: "Copy shortlink", "aria-label": "Copy shortlink", tooltipPlacement: "top", size: "md", name: "share-alt", onClick: () => onPermalinkClick(row), tabIndex: 0 }))))));
});
LogRowMenuCell.displayName = 'LogRowMenuCell';
//# sourceMappingURL=LogRowMenuCell.js.map