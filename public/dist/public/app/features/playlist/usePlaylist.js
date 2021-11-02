import { __awaiter, __generator, __read } from "tslib";
import { useEffect, useState } from 'react';
import { getPlaylist } from './api';
export function usePlaylist(playlistId) {
    var _this = this;
    var _a = __read(useState({ items: [], interval: '5m', name: '' }), 2), playlist = _a[0], setPlaylist = _a[1];
    var _b = __read(useState(true), 2), loading = _b[0], setLoading = _b[1];
    useEffect(function () {
        var initPlaylist = function () { return __awaiter(_this, void 0, void 0, function () {
            var list;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!playlistId) {
                            setLoading(false);
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, getPlaylist(playlistId)];
                    case 1:
                        list = _a.sent();
                        setPlaylist(list);
                        setLoading(false);
                        return [2 /*return*/];
                }
            });
        }); };
        initPlaylist();
    }, [playlistId]);
    return { playlist: playlist, loading: loading };
}
//# sourceMappingURL=usePlaylist.js.map