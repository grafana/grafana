import { useEffect } from 'react';
import { HOME_NAV_ID } from 'app/core/reducers/navModel';
import { useSelector } from 'app/types';
import { Branding } from '../Branding/Branding';
import { buildBreadcrumbs } from '../Breadcrumbs/utils';
export function usePageTitle(navModel, pageNav) {
    var _a;
    const homeNav = (_a = useSelector((state) => state.navIndex)) === null || _a === void 0 ? void 0 : _a[HOME_NAV_ID];
    useEffect(() => {
        var _a;
        const sectionNav = (_a = ((navModel === null || navModel === void 0 ? void 0 : navModel.node) !== (navModel === null || navModel === void 0 ? void 0 : navModel.main) ? navModel === null || navModel === void 0 ? void 0 : navModel.node : navModel === null || navModel === void 0 ? void 0 : navModel.main)) !== null && _a !== void 0 ? _a : { text: 'Grafana' };
        const parts = buildBreadcrumbs(sectionNav, pageNav, homeNav)
            .map((crumb) => crumb.text)
            .reverse();
        // Override `Home` with the custom brand title
        parts[parts.length - 1] = Branding.AppTitle;
        document.title = parts.join(' - ');
    }, [homeNav, navModel, pageNav]);
}
//# sourceMappingURL=usePageTitle.js.map