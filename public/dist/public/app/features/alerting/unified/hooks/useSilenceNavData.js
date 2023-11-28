import { useEffect, useState } from 'react';
import { useRouteMatch } from 'react-router-dom';
const defaultPageNav = {
    icon: 'bell-slash',
};
export function useSilenceNavData() {
    const { isExact, path } = useRouteMatch();
    const [pageNav, setPageNav] = useState();
    useEffect(() => {
        if (path === '/alerting/silence/new') {
            setPageNav(Object.assign(Object.assign({}, defaultPageNav), { id: 'silence-new', text: 'Add silence' }));
        }
        else if (path === '/alerting/silence/:id/edit') {
            setPageNav(Object.assign(Object.assign({}, defaultPageNav), { id: 'silence-edit', text: 'Edit silence' }));
        }
    }, [path, isExact]);
    return pageNav;
}
//# sourceMappingURL=useSilenceNavData.js.map