import React, { useCallback } from 'react';
import { locationService } from '@grafana/runtime';
import { PanelHeaderNotice } from './PanelHeaderNotice';
export const PanelHeaderNotices = ({ frames, panelId }) => {
    const openInspect = useCallback((e, tab) => {
        e.stopPropagation();
        locationService.partial({ inspect: panelId, inspectTab: tab });
    }, [panelId]);
    // dedupe on severity
    const notices = {};
    for (const frame of frames) {
        if (!frame.meta || !frame.meta.notices) {
            continue;
        }
        for (const notice of frame.meta.notices) {
            notices[notice.severity] = notice;
        }
    }
    return (React.createElement(React.Fragment, null, Object.values(notices).map((notice) => (React.createElement(PanelHeaderNotice, { notice: notice, onClick: openInspect, key: notice.severity })))));
};
//# sourceMappingURL=PanelHeaderNotices.js.map