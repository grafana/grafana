import { __awaiter } from "tslib";
import React, { useCallback, useEffect, useState } from 'react';
import { useStyles } from '@grafana/ui';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { DISCOVERY_RDS_CANCEL_TOKEN, INITIAL_CREDENTIALS } from './Discovery.constants';
import DiscoveryService from './Discovery.service';
import { getStyles } from './Discovery.styles';
import Credentials from './components/Credentials/Credentials';
import { DiscoveryDocs } from './components/DiscoveryDocs/DiscoveryDocs';
import Instances from './components/Instances/Instances';
const Discovery = ({ onSubmit, selectInstance }) => {
    const styles = useStyles(getStyles);
    const [instances, setInstances] = useState([]);
    const [credentials, setCredentials] = useState(INITIAL_CREDENTIALS);
    const [loading, startLoading] = useState(false);
    const [generateToken] = useCancelToken();
    const discover = useCallback((credentials, disableNotifications = false) => __awaiter(void 0, void 0, void 0, function* () {
        try {
            setCredentials(credentials);
            startLoading(true);
            const result = yield DiscoveryService.discoveryRDS(credentials, generateToken(DISCOVERY_RDS_CANCEL_TOKEN), disableNotifications);
            if (result) {
                setInstances(result.rds_instances);
            }
        }
        catch (e) {
            if (isApiCancelError(e)) {
                return;
            }
            logger.error(e);
        }
        finally {
            startLoading(false);
        }
    }), 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setCredentials, setInstances]);
    useEffect(() => {
        discover(INITIAL_CREDENTIALS, true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.content },
            React.createElement(Credentials, { discover: (credentials) => onSubmit(discover(credentials)) }),
            React.createElement(Instances, { instances: instances, selectInstance: selectInstance, credentials: credentials, loading: loading }),
            React.createElement(DiscoveryDocs, null))));
};
export default Discovery;
//# sourceMappingURL=Discovery.js.map