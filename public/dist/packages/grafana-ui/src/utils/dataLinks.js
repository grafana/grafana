/**
 * Delays creating links until we need to open the ContextMenu
 */
export var linkModelToContextMenuItems = function (links) {
    return links().map(function (link) {
        return {
            label: link.title,
            ariaLabel: link.title,
            // TODO: rename to href
            url: link.href,
            target: link.target,
            icon: "" + (link.target === '_self' ? 'link' : 'external-link-alt'),
            onClick: link.onClick,
        };
    });
};
//# sourceMappingURL=dataLinks.js.map