import React, { useEffect, useState } from 'react';
import { locationService } from '@grafana/runtime';
import { useTheme2 } from '@grafana/ui';
import { useMediaQueryChange } from 'app/core/hooks/useMediaQueryChange';
import { contextSrv } from 'app/core/services/context_srv';
import { getUserOrganizations, setUserOrganization } from 'app/features/org/state/actions';
import { useDispatch, useSelector } from 'app/types';
import { OrganizationPicker } from './OrganizationPicker';
import { OrganizationSelect } from './OrganizationSelect';
export function OrganizationSwitcher() {
    const theme = useTheme2();
    const dispatch = useDispatch();
    const orgs = useSelector((state) => state.organization.userOrgs);
    const onSelectChange = (option) => {
        if (option.value) {
            setUserOrganization(option.value.orgId);
            locationService.push(`/?orgId=${option.value.orgId}`);
            // TODO how to reload the current page
            window.location.reload();
        }
    };
    useEffect(() => {
        if (contextSrv.isSignedIn) {
            dispatch(getUserOrganizations());
        }
    }, [dispatch]);
    const breakpoint = theme.breakpoints.values.sm;
    const [isSmallScreen, setIsSmallScreen] = useState(!window.matchMedia(`(min-width: ${breakpoint}px)`).matches);
    useMediaQueryChange({
        breakpoint,
        onChange: (e) => {
            setIsSmallScreen(!e.matches);
        },
    });
    if ((orgs === null || orgs === void 0 ? void 0 : orgs.length) <= 1) {
        return null;
    }
    const Switcher = isSmallScreen ? OrganizationPicker : OrganizationSelect;
    return React.createElement(Switcher, { orgs: orgs, onSelectChange: onSelectChange });
}
//# sourceMappingURL=OrganizationSwitcher.js.map