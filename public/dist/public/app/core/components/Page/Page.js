import { __assign, __makeTemplateObject, __rest } from "tslib";
// Libraries
import React, { useEffect } from 'react';
import { getTitleFromNavModel } from 'app/core/selectors/navModel';
// Components
import PageHeader from '../PageHeader/PageHeader';
import { Footer } from '../Footer/Footer';
import { PageContents } from './PageContents';
import { CustomScrollbar, useStyles2 } from '@grafana/ui';
import { Branding } from '../Branding/Branding';
import { css, cx } from '@emotion/css';
export var Page = function (_a) {
    var navModel = _a.navModel, children = _a.children, className = _a.className, otherProps = __rest(_a, ["navModel", "children", "className"]);
    var styles = useStyles2(getStyles);
    useEffect(function () {
        if (navModel) {
            var title = getTitleFromNavModel(navModel);
            document.title = title ? title + " - " + Branding.AppTitle : Branding.AppTitle;
        }
        else {
            document.title = Branding.AppTitle;
        }
    }, [navModel]);
    return (React.createElement("div", __assign({}, otherProps, { className: cx(styles.wrapper, className) }),
        React.createElement(CustomScrollbar, { autoHeightMin: '100%' },
            React.createElement("div", { className: "page-scrollbar-content" },
                navModel && React.createElement(PageHeader, { model: navModel }),
                children,
                React.createElement(Footer, null)))));
};
Page.Header = PageHeader;
Page.Contents = PageContents;
export default Page;
var getStyles = function (theme) { return ({
    wrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n    width: 100%;\n    flex-grow: 1;\n    width: 100%;\n    min-height: 0;\n  "], ["\n    width: 100%;\n    flex-grow: 1;\n    width: 100%;\n    min-height: 0;\n  "]))),
}); };
var templateObject_1;
//# sourceMappingURL=Page.js.map