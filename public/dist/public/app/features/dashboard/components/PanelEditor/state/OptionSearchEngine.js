import { __values } from "tslib";
import { OptionsPaneCategoryDescriptor } from '../OptionsPaneCategoryDescriptor';
var OptionSearchEngine = /** @class */ (function () {
    function OptionSearchEngine(categories, overrides) {
        this.categories = categories;
        this.overrides = overrides;
    }
    OptionSearchEngine.prototype.search = function (query) {
        var searchRegex = new RegExp(query, 'i');
        var optionHits = this.collectHits(this.categories, searchRegex, []);
        var sortedHits = optionHits.sort(compareHit).map(function (x) { return x.item; });
        var overrideHits = this.collectHits(this.overrides, searchRegex, []);
        var sortedOverridesHits = overrideHits.sort(compareHit).map(function (x) { return x.item; });
        return {
            optionHits: sortedHits,
            overrideHits: this.buildOverrideHitCategories(sortedOverridesHits),
            totalCount: this.getAllOptionsCount(this.categories),
        };
    };
    OptionSearchEngine.prototype.collectHits = function (categories, searchRegex, hits) {
        var e_1, _a, e_2, _b;
        try {
            for (var categories_1 = __values(categories), categories_1_1 = categories_1.next(); !categories_1_1.done; categories_1_1 = categories_1.next()) {
                var category = categories_1_1.value;
                var categoryNameMatch = searchRegex.test(category.props.title);
                try {
                    for (var _c = (e_2 = void 0, __values(category.items)), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var item = _d.value;
                        if (searchRegex.test(item.props.title)) {
                            hits.push({ item: item, rank: 1 });
                            continue;
                        }
                        if (item.props.description && searchRegex.test(item.props.description)) {
                            hits.push({ item: item, rank: 2 });
                            continue;
                        }
                        if (categoryNameMatch) {
                            hits.push({ item: item, rank: 3 });
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
                if (category.categories.length > 0) {
                    this.collectHits(category.categories, searchRegex, hits);
                }
            }
        }
        catch (e_1_1) { e_1 = { error: e_1_1 }; }
        finally {
            try {
                if (categories_1_1 && !categories_1_1.done && (_a = categories_1.return)) _a.call(categories_1);
            }
            finally { if (e_1) throw e_1.error; }
        }
        return hits;
    };
    OptionSearchEngine.prototype.getAllOptionsCount = function (categories) {
        var e_3, _a;
        var total = 0;
        try {
            for (var categories_2 = __values(categories), categories_2_1 = categories_2.next(); !categories_2_1.done; categories_2_1 = categories_2.next()) {
                var category = categories_2_1.value;
                total += category.items.length;
                if (category.categories.length > 0) {
                    total += this.getAllOptionsCount(category.categories);
                }
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (categories_2_1 && !categories_2_1.done && (_a = categories_2.return)) _a.call(categories_2);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return total;
    };
    OptionSearchEngine.prototype.buildOverrideHitCategories = function (hits) {
        var e_4, _a;
        var categories = {};
        try {
            for (var hits_1 = __values(hits), hits_1_1 = hits_1.next(); !hits_1_1.done; hits_1_1 = hits_1.next()) {
                var hit = hits_1_1.value;
                var category = categories[hit.parent.props.title];
                if (!category) {
                    category = categories[hit.parent.props.title] = new OptionsPaneCategoryDescriptor(hit.parent.props);
                    // Add matcher item as that should always be shown
                    category.addItem(hit.parent.items[0]);
                }
                // Prevent adding matcher twice since it's automatically added for every override
                if (category.items[0].props.title !== hit.props.title) {
                    category.addItem(hit);
                }
            }
        }
        catch (e_4_1) { e_4 = { error: e_4_1 }; }
        finally {
            try {
                if (hits_1_1 && !hits_1_1.done && (_a = hits_1.return)) _a.call(hits_1);
            }
            finally { if (e_4) throw e_4.error; }
        }
        return Object.values(categories);
    };
    return OptionSearchEngine;
}());
export { OptionSearchEngine };
function compareHit(left, right) {
    return left.rank - right.rank;
}
//# sourceMappingURL=OptionSearchEngine.js.map