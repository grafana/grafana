import { __extends } from "tslib";
import React from 'react';
import { Record } from 'immutable';
import TOKEN_MARK from './TOKEN_MARK';
/**
 * Default filter for code blocks
 */
function defaultOnlyIn(node) {
    return node.object === 'block' && node.type === 'code_block';
}
/**
 * Default getter for syntax
 */
function defaultGetSyntax(node) {
    return 'javascript';
}
/**
 * Default rendering for decorations
 */
function defaultRenderDecoration(props, editor, next) {
    var decoration = props.decoration;
    if (decoration.type !== TOKEN_MARK) {
        return next();
    }
    var className = decoration.data.get('className');
    return React.createElement("span", { className: className }, props.children);
}
/**
 * The plugin options
 */
var Options = /** @class */ (function (_super) {
    __extends(Options, _super);
    function Options(props) {
        return _super.call(this, props) || this;
    }
    return Options;
}(Record({
    onlyIn: defaultOnlyIn,
    getSyntax: defaultGetSyntax,
    renderDecoration: defaultRenderDecoration,
})));
export default Options;
//# sourceMappingURL=options.js.map