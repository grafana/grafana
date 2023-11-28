import { useSelector } from 'app/types';
import { getNavModel } from '../selectors/navModel';
export const useNavModel = (id) => {
    const navIndex = useSelector((state) => state.navIndex);
    return getNavModel(navIndex, id);
};
//# sourceMappingURL=useNavModel.js.map