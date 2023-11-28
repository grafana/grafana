import { useEffect, useState } from 'react';
import { useSelector } from 'app/types';
import { getRecentDashboardActions } from './dashboardActions';
import getStaticActions from './staticActions';
export default function useActions(searchQuery) {
    const [navTreeActions, setNavTreeActions] = useState([]);
    const [recentDashboardActions, setRecentDashboardActions] = useState([]);
    const { navBarTree } = useSelector((state) => {
        return {
            navBarTree: state.navBarTree,
        };
    });
    // Load standard static actions
    useEffect(() => {
        const staticActionsResp = getStaticActions(navBarTree);
        setNavTreeActions(staticActionsResp);
    }, [navBarTree]);
    // Load recent dashboards - we don't want them to reload when the nav tree changes
    useEffect(() => {
        if (!searchQuery) {
            getRecentDashboardActions()
                .then((recentDashboardActions) => setRecentDashboardActions(recentDashboardActions))
                .catch((err) => {
                console.error('Error loading recent dashboard actions', err);
            });
        }
    }, [searchQuery]);
    return searchQuery ? navTreeActions : [...recentDashboardActions, ...navTreeActions];
}
//# sourceMappingURL=useActions.js.map