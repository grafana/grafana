import { __values } from "tslib";
import React, { useCallback } from 'react';
import { PanelHeaderNotice } from './PanelHeaderNotice';
import { locationService } from '@grafana/runtime';
export var PanelHeaderNotices = function (_a) {
    var e_1, _b, e_2, _c;
    var frames = _a.frames, panelId = _a.panelId;
    var openInspect = useCallback(function (e, tab) {
        e.stopPropagation();
        locationService.partial({ inspect: panelId, inspectTab: tab });
    }, [panelId]);
    // dedupe on severity
    var notices = {};
    try {
        for (var frames_1 = __values(frames), frames_1_1 = frames_1.next(); !frames_1_1.done; frames_1_1 = frames_1.next()) {
            var frame = frames_1_1.value;
            if (!frame.meta || !frame.meta.notices) {
                continue;
            }
            try {
                for (var _d = (e_2 = void 0, __values(frame.meta.notices)), _e = _d.next(); !_e.done; _e = _d.next()) {
                    var notice = _e.value;
                    notices[notice.severity] = notice;
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_e && !_e.done && (_c = _d.return)) _c.call(_d);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (frames_1_1 && !frames_1_1.done && (_b = frames_1.return)) _b.call(frames_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return (React.createElement(React.Fragment, null, Object.values(notices).map(function (notice) { return (React.createElement(PanelHeaderNotice, { notice: notice, onClick: openInspect, key: notice.severity })); })));
};
//# sourceMappingURL=PanelHeaderNotices.js.map