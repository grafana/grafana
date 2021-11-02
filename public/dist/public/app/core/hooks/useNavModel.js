import { useSelector } from 'react-redux';
import { getNavModel } from '../selectors/navModel';
export var useNavModel = function (id) {
    var navIndex = useSelector(function (state) { return state.navIndex; });
    return getNavModel(navIndex, id);
};
//# sourceMappingURL=useNavModel.js.map