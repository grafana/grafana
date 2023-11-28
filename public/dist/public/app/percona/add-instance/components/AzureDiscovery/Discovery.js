import { __awaiter } from "tslib";
import React, { useEffect, useState } from 'react';
import { useStyles } from '@grafana/ui';
import { useCancelToken } from 'app/percona/shared/components/hooks/cancelToken.hook';
import { isApiCancelError } from 'app/percona/shared/helpers/api';
import { logger } from 'app/percona/shared/helpers/logger';
import { DISCOVERY_AZURE_CANCEL_TOKEN } from './Discovery.constants';
import DiscoveryService from './Discovery.service';
import { getStyles } from './Discovery.styles';
import Credentials from './components/Credentials/Credentials';
import Instances from './components/Instances/Instances';
const Discovery = ({ onSubmit, selectInstance }) => {
    const styles = useStyles(getStyles);
    const [instances, setInstances] = useState([]);
    const [credentials, setCredentials] = useState({});
    const [loading, startLoading] = useState(false);
    const [generateToken] = useCancelToken();
    useEffect(() => {
        const updateInstances = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const result = yield DiscoveryService.discoveryAzure(credentials, generateToken(DISCOVERY_AZURE_CANCEL_TOKEN));
                if (result) {
                    setInstances(result.azure_database_instance);
                }
            }
            catch (e) {
                if (isApiCancelError(e)) {
                    return;
                }
                logger.error(e);
            }
            startLoading(false);
        });
        if (credentials.azure_client_id &&
            credentials.azure_client_secret &&
            credentials.azure_tenant_id &&
            credentials.azure_subscription_id) {
            startLoading(true);
            updateInstances();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [credentials]);
    return (React.createElement(React.Fragment, null,
        React.createElement("div", { className: styles.content },
            React.createElement(Credentials, { onSetCredentials: setCredentials, selectInstance: selectInstance }),
            React.createElement(Instances, { instances: instances, selectInstance: selectInstance, credentials: credentials, loading: loading }))));
};
export default Discovery;
//# sourceMappingURL=Discovery.js.map