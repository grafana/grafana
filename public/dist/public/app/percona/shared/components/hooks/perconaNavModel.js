import { getNavModel } from 'app/core/selectors/navModel';
import { useSelector } from 'app/types';
export const usePerconaNavModel = (id) => {
    const navIndex = useSelector((state) => state.navIndex);
    const model = getNavModel(navIndex, id);
    model.pageTitle = `${model.main.text}: ${model.node.text}`;
    // Grafana's way to generate breadcrumbs is kinda weird, hence this change
    model.main.text = model.node.text;
    return model;
};
//# sourceMappingURL=perconaNavModel.js.map