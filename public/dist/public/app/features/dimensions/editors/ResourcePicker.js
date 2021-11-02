import { __assign, __makeTemplateObject, __read } from "tslib";
import React, { useEffect, useState } from 'react';
import { TabContent, Button, Select, Input, Spinner, TabsBar, Tab, StringValueEditor, useTheme2, stylesFactory, } from '@grafana/ui';
import { ResourceCards } from './ResourceCards';
import SVG from 'react-inlinesvg';
import { css } from '@emotion/css';
import { getPublicOrAbsoluteUrl } from '../resource';
import { getDatasourceSrv } from 'app/features/plugins/datasource_srv';
import { ResourceFolderName } from '..';
export function ResourcePicker(props) {
    var value = props.value, onChange = props.onChange, mediaType = props.mediaType, folderName = props.folderName;
    var folders = getFolders(mediaType).map(function (v) { return ({
        label: v,
        value: v,
    }); });
    var folderOfCurrentValue = value || folderName ? folderIfExists(folders, value !== null && value !== void 0 ? value : folderName) : folders[0];
    var _a = __read(useState(folderOfCurrentValue), 2), currentFolder = _a[0], setCurrentFolder = _a[1];
    var _b = __read(useState([
        { label: 'Select', active: true },
        // { label: 'Upload', active: false },
    ]), 2), tabs = _b[0], setTabs = _b[1];
    var _c = __read(useState([]), 2), directoryIndex = _c[0], setDirectoryIndex = _c[1];
    var _d = __read(useState([]), 2), filteredIndex = _d[0], setFilteredIndex = _d[1];
    var theme = useTheme2();
    var styles = getStyles(theme);
    useEffect(function () {
        // we don't want to load everything before picking a folder
        var folder = currentFolder === null || currentFolder === void 0 ? void 0 : currentFolder.value;
        if (folder) {
            var filter_1 = mediaType === 'icon'
                ? function (item) { return item.name.endsWith('.svg'); }
                : function (item) { return item.name.endsWith('.png') || item.name.endsWith('.gif'); };
            getDatasourceSrv()
                .get('-- Grafana --')
                .then(function (ds) {
                ds.listFiles(folder).subscribe({
                    next: function (frame) {
                        var cards = [];
                        frame.forEach(function (item) {
                            if (filter_1(item)) {
                                var idx = item.name.lastIndexOf('.');
                                cards.push({
                                    value: item.name,
                                    label: item.name,
                                    search: (idx ? item.name.substr(0, idx) : item.name).toLowerCase(),
                                    imgUrl: "public/" + folder + "/" + item.name,
                                });
                            }
                        });
                        setDirectoryIndex(cards);
                        setFilteredIndex(cards);
                    },
                });
            });
        }
    }, [mediaType, currentFolder]);
    var onChangeSearch = function (e) {
        var query = e.currentTarget.value;
        if (query) {
            query = query.toLowerCase();
            setFilteredIndex(directoryIndex.filter(function (card) { return card.search.includes(query); }));
        }
        else {
            setFilteredIndex(directoryIndex);
        }
    };
    var imgSrc = getPublicOrAbsoluteUrl(value);
    return (React.createElement("div", null,
        React.createElement("div", { className: styles.currentItem },
            value && (React.createElement(React.Fragment, null,
                mediaType === 'icon' && React.createElement(SVG, { src: imgSrc, className: styles.img }),
                mediaType === 'image' && React.createElement("img", { src: imgSrc, className: styles.img }))),
            React.createElement(StringValueEditor, { value: value !== null && value !== void 0 ? value : '', onChange: onChange, item: {}, context: {} }),
            React.createElement(Button, { variant: "secondary", onClick: function () { return onChange(value); } }, "Apply")),
        React.createElement(TabsBar, null, tabs.map(function (tab, index) { return (React.createElement(Tab, { label: tab.label, key: index, active: tab.active, onChangeTab: function () { return setTabs(tabs.map(function (tab, idx) { return (__assign(__assign({}, tab), { active: idx === index })); })); } })); })),
        React.createElement(TabContent, null, tabs[0].active && (React.createElement("div", { className: styles.tabContent },
            React.createElement(Select, { menuShouldPortal: true, options: folders, onChange: setCurrentFolder, value: currentFolder }),
            React.createElement(Input, { placeholder: "Search", onChange: onChangeSearch }),
            filteredIndex ? (React.createElement("div", { className: styles.cardsWrapper },
                React.createElement(ResourceCards, { cards: filteredIndex, onChange: onChange, currentFolder: currentFolder }))) : (React.createElement(Spinner, null)))))));
}
var getStyles = stylesFactory(function (theme) {
    return {
        cardsWrapper: css(templateObject_1 || (templateObject_1 = __makeTemplateObject(["\n      height: calc(100vh - 480px);\n    "], ["\n      height: calc(100vh - 480px);\n    "]))),
        tabContent: css(templateObject_2 || (templateObject_2 = __makeTemplateObject(["\n      margin-top: 20px;\n      & > :nth-child(2) {\n        margin-top: 10px;\n      },\n    "], ["\n      margin-top: 20px;\n      & > :nth-child(2) {\n        margin-top: 10px;\n      },\n    "]))),
        currentItem: css(templateObject_3 || (templateObject_3 = __makeTemplateObject(["\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      column-gap: 2px;\n      margin: -18px 0px 18px 0px;\n    "], ["\n      display: flex;\n      justify-content: space-between;\n      align-items: center;\n      column-gap: 2px;\n      margin: -18px 0px 18px 0px;\n    "]))),
        img: css(templateObject_4 || (templateObject_4 = __makeTemplateObject(["\n      width: 40px;\n      height: 40px;\n      fill: ", ";\n    "], ["\n      width: 40px;\n      height: 40px;\n      fill: ", ";\n    "])), theme.colors.text.primary),
    };
});
var getFolders = function (mediaType) {
    if (mediaType === 'icon') {
        return [ResourceFolderName.Icon, ResourceFolderName.IOT, ResourceFolderName.Marker];
    }
    else {
        return [ResourceFolderName.BG];
    }
};
var folderIfExists = function (folders, path) {
    var _a;
    return (_a = folders.filter(function (folder) { return path.indexOf(folder.value) > -1; })[0]) !== null && _a !== void 0 ? _a : folders[0];
};
var templateObject_1, templateObject_2, templateObject_3, templateObject_4;
//# sourceMappingURL=ResourcePicker.js.map