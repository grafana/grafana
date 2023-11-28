import React, { useState } from 'react';
import { urlUtil } from '@grafana/data';
import { Checkbox, ClipboardButton, Field, FieldSet, Input, Modal, RadioButtonGroup } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { buildBaseUrl } from 'app/features/dashboard/components/ShareModal/utils';
export const ShareModal = ({ playlistUid, onDismiss }) => {
    const [mode, setMode] = useState(false);
    const [autoFit, setAutofit] = useState(false);
    const modes = [
        { label: t('share-playlist.mode-normal', 'Normal'), value: false },
        { label: t('share-playlist.mode-tv', 'TV'), value: 'tv' },
        { label: t('share-playlist.mode-kiosk', 'Kiosk'), value: true },
    ];
    const params = {};
    if (mode) {
        params.kiosk = mode;
    }
    if (autoFit) {
        params.autofitpanels = true;
    }
    const shareUrl = urlUtil.renderUrl(`${buildBaseUrl()}/play/${playlistUid}`, params);
    return (React.createElement(Modal, { isOpen: true, title: t('share-playlist.title', 'Share playlist'), onDismiss: onDismiss },
        React.createElement(FieldSet, null,
            React.createElement(Field, { label: t('share-playlist.mode', 'Mode') },
                React.createElement(RadioButtonGroup, { value: mode, options: modes, onChange: setMode })),
            React.createElement(Field, null,
                React.createElement(Checkbox, { label: t('share-playlist.checkbox-label', 'Autofit'), description: t('share-playlist.checkbox-description', 'Panel heights will be adjusted to fit screen size'), name: "autofix", value: autoFit, onChange: (e) => setAutofit(e.currentTarget.checked) })),
            React.createElement(Field, { label: t('share-playlist.link-url-label', 'Link URL') },
                React.createElement(Input, { id: "link-url-input", value: shareUrl, readOnly: true, addonAfter: React.createElement(ClipboardButton, { icon: "copy", variant: "primary", getText: () => shareUrl },
                        React.createElement(Trans, { i18nKey: "share-playlist.copy-link-button" }, "Copy")) })))));
};
//# sourceMappingURL=ShareModal.js.map