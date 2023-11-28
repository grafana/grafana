import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { useStyles2 } from '@grafana/ui';
import { CollapsableSection } from '@grafana/ui/src/components';
import { OldPage } from 'app/core/components/Page/Page';
import { Overlay } from 'app/percona/shared/components/Elements/Overlay';
import { usePerconaNavModel } from 'app/percona/shared/components/hooks/perconaNavModel';
import { logger } from 'app/percona/shared/helpers/logger';
import { useSelector } from 'app/types';
import { PlatformConnectedLoader } from '../shared/components/Elements/PlatformConnectedLoader';
import { useCancelToken } from '../shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from '../shared/helpers/api';
import { LIST_ENTITLEMENTS_CANCEL_TOKEN } from './Entitlements.contants';
import { Messages } from './Entitlements.messages';
import EntitlementsService from './Entitlements.service';
import { getStyles } from './Entitlements.styles';
import { PageContent } from './components/PageContent/PageContent';
import { SectionContent } from './components/SectionContent/SectionContent';
import { Label } from './components/SectionLabel/SectionLabel';
const EntitlementsPage = () => {
    const [pendingRequest, setPendingRequest] = useState(true);
    const [data, setData] = useState([]);
    const isConnectedToPortal = useSelector((state) => !!state.percona.user.isPlatformUser);
    const [generateToken] = useCancelToken();
    const styles = useStyles2(getStyles);
    const navModel = usePerconaNavModel('entitlements');
    const getData = useCallback((showLoading = false) => __awaiter(void 0, void 0, void 0, function* () {
        showLoading && setPendingRequest(true);
        try {
            const entitlements = yield EntitlementsService.list(generateToken(LIST_ENTITLEMENTS_CANCEL_TOKEN));
            setData(entitlements);
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        setPendingRequest(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }), []);
    useEffect(() => {
        if (isConnectedToPortal === true) {
            getData(true);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnectedToPortal]);
    return (React.createElement(OldPage, { navModel: navModel },
        React.createElement(OldPage.Contents, { dataTestId: "page-wrapper-entitlements" },
            React.createElement(PlatformConnectedLoader, null,
                React.createElement(Overlay, { dataTestId: "entitlements-loading", isPending: pendingRequest },
                    React.createElement(PageContent, { hasData: data.length > 0, emptyMessage: Messages.noData, loading: pendingRequest }, data.map((entitlement) => {
                        const { number, name, endDate } = entitlement;
                        return (React.createElement("div", { key: number, className: styles.collapseWrapper },
                            React.createElement(CollapsableSection, { label: React.createElement(Label, { name: name, endDate: endDate }), isOpen: false },
                                React.createElement(SectionContent, { entitlement: entitlement }))));
                    })))))));
};
export default EntitlementsPage;
//# sourceMappingURL=EntitlementsPage.js.map