import { __values } from "tslib";
export function getRecentOptions(allOptions) {
    var e_1, _a, e_2, _b;
    var popularOptions = [];
    try {
        for (var allOptions_1 = __values(allOptions), allOptions_1_1 = allOptions_1.next(); !allOptions_1_1.done; allOptions_1_1 = allOptions_1.next()) {
            var category = allOptions_1_1.value;
            try {
                for (var _c = (e_2 = void 0, __values(category.items)), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var item = _d.value;
                    if (item.props.title === 'Unit') {
                        item.props.popularRank = 2;
                    }
                    if (item.props.title === 'Min') {
                        item.props.popularRank = 3;
                    }
                    if (item.props.title === 'Max') {
                        item.props.popularRank = 4;
                    }
                    if (item.props.title === 'Display name') {
                        item.props.popularRank = 5;
                    }
                    if (item.props.popularRank) {
                        popularOptions.push(item);
                    }
                }
            }
            catch (e_2_1) { e_2 = { error: e_2_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_b = _c.return)) _b.call(_c);
                }
                finally { if (e_2) throw e_2.error; }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (allOptions_1_1 && !allOptions_1_1.done && (_a = allOptions_1.return)) _a.call(allOptions_1);
        }
        finally { if (e_1) throw e_1.error; }
    }
    return popularOptions.sort(function (left, right) { return left.props.popularRank - right.props.popularRank; });
}
//# sourceMappingURL=getRecentOptions.js.map