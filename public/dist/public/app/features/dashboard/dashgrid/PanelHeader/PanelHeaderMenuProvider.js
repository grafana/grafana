import { useEffect, useState } from 'react';
import { getPanelStateForModel } from 'app/features/panel/state/selectors';
import { useSelector } from 'app/types';
import { getPanelMenu } from '../../utils/getPanelMenu';
export function PanelHeaderMenuProvider({ panel, dashboard, loadingState, children }) {
    const [items, setItems] = useState([]);
    const angularComponent = useSelector((state) => { var _a; return (_a = getPanelStateForModel(state, panel)) === null || _a === void 0 ? void 0 : _a.angularComponent; });
    useEffect(() => {
        setItems(getPanelMenu(dashboard, panel, angularComponent));
    }, [dashboard, panel, angularComponent, loadingState, setItems]);
    return children({ items });
}
//# sourceMappingURL=PanelHeaderMenuProvider.js.map