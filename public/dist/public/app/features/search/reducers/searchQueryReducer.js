import { __assign, __read, __spreadArray } from "tslib";
import { SearchLayout } from '../types';
import { ADD_TAG, CLEAR_FILTERS, LAYOUT_CHANGE, QUERY_CHANGE, REMOVE_STARRED, REMOVE_TAG, SET_TAGS, TOGGLE_SORT, TOGGLE_STARRED, } from './actionTypes';
export var defaultQuery = {
    query: '',
    tag: [],
    starred: false,
    skipRecent: false,
    skipStarred: false,
    folderIds: [],
    sort: null,
    layout: SearchLayout.Folders,
    prevSort: null,
};
export var defaultQueryParams = {
    sort: null,
    starred: null,
    query: null,
    tag: null,
    layout: null,
};
export var queryReducer = function (state, action) {
    switch (action.type) {
        case QUERY_CHANGE:
            return __assign(__assign({}, state), { query: action.payload });
        case REMOVE_TAG:
            return __assign(__assign({}, state), { tag: state.tag.filter(function (t) { return t !== action.payload; }) });
        case SET_TAGS:
            return __assign(__assign({}, state), { tag: action.payload });
        case ADD_TAG: {
            var tag = action.payload;
            return tag && !state.tag.includes(tag) ? __assign(__assign({}, state), { tag: __spreadArray(__spreadArray([], __read(state.tag), false), [tag], false) }) : state;
        }
        case TOGGLE_STARRED:
            return __assign(__assign({}, state), { starred: action.payload });
        case REMOVE_STARRED:
            return __assign(__assign({}, state), { starred: false });
        case CLEAR_FILTERS:
            return __assign(__assign({}, state), { query: '', tag: [], starred: false, sort: null });
        case TOGGLE_SORT: {
            var sort = action.payload;
            if (state.layout === SearchLayout.Folders) {
                return __assign(__assign({}, state), { sort: sort, layout: SearchLayout.List });
            }
            return __assign(__assign({}, state), { sort: sort });
        }
        case LAYOUT_CHANGE: {
            var layout = action.payload;
            if (state.sort && layout === SearchLayout.Folders) {
                return __assign(__assign({}, state), { layout: layout, sort: null, prevSort: state.sort });
            }
            return __assign(__assign({}, state), { layout: layout, sort: state.prevSort });
        }
        default:
            return state;
    }
};
//# sourceMappingURL=searchQueryReducer.js.map