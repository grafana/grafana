import { __read } from "tslib";
import React, { useState } from 'react';
import { urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Checkbox, Field, Modal, RadioButtonGroup, VerticalGroup } from '@grafana/ui';
export var StartModal = function (_a) {
    var playlist = _a.playlist, onDismiss = _a.onDismiss;
    var _b = __read(useState(false), 2), mode = _b[0], setMode = _b[1];
    var _c = __read(useState(false), 2), autoFit = _c[0], setAutofit = _c[1];
    var modes = [
        { label: 'Normal', value: false },
        { label: 'TV', value: 'tv' },
        { label: 'Kiosk', value: true },
    ];
    var onStart = function () {
        var params = {};
        if (mode) {
            params.kiosk = mode;
        }
        if (autoFit) {
            params.autofitpanels = true;
        }
        locationService.push(urlUtil.renderUrl("/playlists/play/" + playlist.id, params));
    };
    return (React.createElement(Modal, { isOpen: true, icon: "play", title: "Start playlist", onDismiss: onDismiss },
        React.createElement(VerticalGroup, null,
            React.createElement(Field, { label: "Mode" },
                React.createElement(RadioButtonGroup, { value: mode, options: modes, onChange: setMode })),
            React.createElement(Checkbox, { label: "Autofit", description: "Panel heights will be adjusted to fit screen size", name: "autofix", value: autoFit, onChange: function (e) { return setAutofit(e.currentTarget.checked); } })),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "primary", onClick: onStart },
                "Start ",
                playlist.name))));
};
//# sourceMappingURL=StartModal.js.map