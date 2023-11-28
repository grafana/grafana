import React, { useState } from 'react';
import { urlUtil } from '@grafana/data';
import { locationService } from '@grafana/runtime';
import { Button, Checkbox, Field, FieldSet, Modal, RadioButtonGroup } from '@grafana/ui';
export const StartModal = ({ playlist, onDismiss }) => {
    const [mode, setMode] = useState(false);
    const [autoFit, setAutofit] = useState(false);
    const modes = [
        { label: 'Normal', value: false },
        { label: 'TV', value: 'tv' },
        { label: 'Kiosk', value: true },
    ];
    const onStart = () => {
        const params = {};
        if (mode) {
            params.kiosk = mode;
        }
        if (autoFit) {
            params.autofitpanels = true;
        }
        locationService.push(urlUtil.renderUrl(`/playlists/play/${playlist.uid}`, params));
    };
    return (React.createElement(Modal, { isOpen: true, icon: "play", title: "Start playlist", onDismiss: onDismiss },
        React.createElement(FieldSet, null,
            React.createElement(Field, { label: "Mode" },
                React.createElement(RadioButtonGroup, { value: mode, options: modes, onChange: setMode })),
            React.createElement(Checkbox, { label: "Autofit", description: "Panel heights will be adjusted to fit screen size", name: "autofix", value: autoFit, onChange: (e) => setAutofit(e.currentTarget.checked) })),
        React.createElement(Modal.ButtonRow, null,
            React.createElement(Button, { variant: "primary", onClick: onStart },
                "Start ",
                playlist.name))));
};
//# sourceMappingURL=StartModal.js.map