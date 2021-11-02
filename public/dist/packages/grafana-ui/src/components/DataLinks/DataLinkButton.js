import { __assign } from "tslib";
import React from 'react';
import { Button } from '../Button';
/**
 * @internal
 */
export function DataLinkButton(_a) {
    var link = _a.link, buttonProps = _a.buttonProps;
    return (React.createElement("a", { href: link.href, target: link.target, rel: "noreferrer", onClick: link.onClick
            ? function (event) {
                if (!(event.ctrlKey || event.metaKey || event.shiftKey) && link.onClick) {
                    event.preventDefault();
                    link.onClick(event);
                }
            }
            : undefined },
        React.createElement(Button, __assign({ icon: "external-link-alt", variant: "primary", size: "sm" }, buttonProps), link.title)));
}
//# sourceMappingURL=DataLinkButton.js.map