import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import { isString } from 'lodash';
import React, { useMemo } from 'react';
import { useAsync } from 'react-use';
import AutoSizer from 'react-virtualized-auto-sizer';
import { CodeEditor, useStyles2 } from '@grafana/ui';
import { SanitizedSVG } from 'app/core/components/SVG/SanitizedSVG';
import { getGrafanaStorage } from './storage';
import { StorageView } from './types';
export function FileView({ listing, path, onPathChange, view }) {
    const styles = useStyles2(getStyles);
    const info = useMemo(() => getFileDisplayInfo(path), [path]);
    const body = useAsync(() => __awaiter(this, void 0, void 0, function* () {
        if (info.category === 'text') {
            const rsp = yield getGrafanaStorage().get(path);
            if (isString(rsp)) {
                return rsp;
            }
            return JSON.stringify(rsp, null, 2);
        }
        return null;
    }), [info, path]);
    switch (view) {
        case StorageView.Config:
            return React.createElement("div", null, "CONFIGURE?");
        case StorageView.Perms:
            return React.createElement("div", null, "Permissions");
        case StorageView.History:
            return React.createElement("div", null, "TODO... history");
    }
    let src = `api/storage/read/${path}`;
    if (src.endsWith('/')) {
        src = src.substring(0, src.length - 1);
    }
    switch (info.category) {
        case 'svg':
            return (React.createElement("div", null,
                React.createElement(SanitizedSVG, { src: src, className: styles.icon })));
        case 'image':
            return (React.createElement("div", null,
                React.createElement("a", { target: '_self', href: src },
                    React.createElement("img", { src: src, alt: "File preview", className: styles.img }))));
        case 'text':
            return (React.createElement("div", { className: styles.tableWrapper },
                React.createElement(AutoSizer, null, ({ width, height }) => {
                    var _a, _b;
                    return (React.createElement(CodeEditor, { width: width, height: height, value: (_a = body.value) !== null && _a !== void 0 ? _a : '', showLineNumbers: false, readOnly: true, language: (_b = info.language) !== null && _b !== void 0 ? _b : 'text', showMiniMap: false, onBlur: (text) => {
                            console.log('CHANGED!', text);
                        } }));
                })));
    }
    return (React.createElement("div", null,
        "FILE: ",
        React.createElement("a", { href: src }, path)));
}
function getFileDisplayInfo(path) {
    const idx = path.lastIndexOf('.');
    if (idx < 0) {
        return {};
    }
    const suffix = path.substring(idx + 1).toLowerCase();
    switch (suffix) {
        case 'svg':
            return { category: 'svg' };
        case 'jpg':
        case 'jpeg':
        case 'png':
        case 'webp':
        case 'gif':
            return { category: 'image' };
        case 'geojson':
        case 'json':
            return { category: 'text', language: 'json' };
        case 'text':
        case 'go':
        case 'md':
            return { category: 'text' };
    }
    return {};
}
const getStyles = (theme) => ({
    // TODO: remove `height: 90%`
    wrapper: css `
    display: flex;
    flex-direction: column;
    height: 100%;
  `,
    tableControlRowWrapper: css `
    display: flex;
    flex-direction: row;
    align-items: center;
    margin-bottom: ${theme.spacing(2)};
  `,
    // TODO: remove `height: 100%`
    tableWrapper: css `
    border: 1px solid ${theme.colors.border.medium};
    height: 100%;
  `,
    uploadSpot: css `
    margin-left: ${theme.spacing(2)};
  `,
    border: css `
    border: 1px solid ${theme.colors.border.medium};
    padding: ${theme.spacing(2)};
  `,
    img: css `
    max-width: 100%;
    // max-height: 147px;
    // fill: ${theme.colors.text.primary};
  `,
    icon: css `
    // max-width: 100%;
    // max-height: 147px;
    // fill: ${theme.colors.text.primary};
  `,
});
//# sourceMappingURL=FileView.js.map