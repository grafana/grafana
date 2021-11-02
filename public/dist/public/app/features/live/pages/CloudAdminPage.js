import { __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { getBackendSrv } from '@grafana/runtime';
import { useStyles } from '@grafana/ui';
import Page from 'app/core/components/Page/Page';
import { useNavModel } from 'app/core/hooks/useNavModel';
import { css } from '@emotion/css';
export default function CloudAdminPage() {
    var navModel = useNavModel('live-cloud');
    var _a = __read(useState([]), 2), cloud = _a[0], setCloud = _a[1];
    var _b = __read(useState(), 2), error = _b[0], setError = _b[1];
    var styles = useStyles(getStyles);
    useEffect(function () {
        getBackendSrv()
            .get("api/live/remote-write-backends")
            .then(function (data) {
            setCloud(data.remoteWriteBackends);
        })
            .catch(function (e) {
            if (e.data) {
                setError(JSON.stringify(e.data, null, 2));
            }
        });
    }, []);
    return (React.createElement(Page, { navModel: navModel },
        React.createElement(Page.Contents, null,
            error && React.createElement("pre", null, error),
            !cloud && React.createElement(React.Fragment, null, "Loading cloud definitions"),
            cloud &&
                cloud.map(function (v) {
                    return (React.createElement("div", { key: v.uid },
                        React.createElement("h2", null, v.uid),
                        React.createElement("pre", { className: styles.row }, JSON.stringify(v.settings, null, 2))));
                }))));
}
var getStyles = function (theme) {
    return {
        row: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      cursor: pointer;\n    "], ["\n      cursor: pointer;\n    "]))),
    };
};
var templateObject_1;
//# sourceMappingURL=CloudAdminPage.js.map