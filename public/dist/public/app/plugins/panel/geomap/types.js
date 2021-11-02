import { MapCenterID } from './view';
export var defaultView = {
    id: MapCenterID.Zero,
    lat: 0,
    lon: 0,
    zoom: 1,
};
export var ComparisonOperation;
(function (ComparisonOperation) {
    ComparisonOperation["EQ"] = "eq";
    ComparisonOperation["LT"] = "lt";
    ComparisonOperation["LTE"] = "lte";
    ComparisonOperation["GT"] = "gt";
    ComparisonOperation["GTE"] = "gte";
})(ComparisonOperation || (ComparisonOperation = {}));
//# sourceMappingURL=types.js.map