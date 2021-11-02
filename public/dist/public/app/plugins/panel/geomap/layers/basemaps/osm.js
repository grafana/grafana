import { __awaiter, __generator } from "tslib";
import OSM from 'ol/source/OSM';
import TileLayer from 'ol/layer/Tile';
export var standard = {
    id: 'osm-standard',
    name: 'Open Street Map',
    isBaseMap: true,
    /**
     * Function that configures transformation and returns a transformer
     * @param options
     */
    create: function (map, options) { return __awaiter(void 0, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, ({
                    init: function () {
                        return new TileLayer({
                            source: new OSM(),
                        });
                    },
                })];
        });
    }); },
};
export var osmLayers = [standard];
//# sourceMappingURL=osm.js.map