import { __awaiter } from "tslib";
import { useEffect } from 'react';
import { logger } from 'app/percona/shared/helpers/logger';
import { isOptionEmpty, newDBClusterService } from '../../DBCluster.utils';
import { BasicOptionsFields } from './DBClusterBasicOptions.types';
import { findDefaultDatabaseVersion } from './DBClusterBasicOptions.utils';
export const useDatabaseVersions = (form, databaseType, kubernetesCluster, setLoadingDatabaseVersions, setDatabaseVersions) => {
    useEffect(() => {
        const getDatabaseVersions = () => __awaiter(void 0, void 0, void 0, function* () {
            try {
                const dbClusterService = newDBClusterService(databaseType.value);
                setLoadingDatabaseVersions(true);
                const databaseVersions = yield (yield dbClusterService.getDatabaseVersions(kubernetesCluster.value)).filter(({ disabled }) => !disabled);
                setDatabaseVersions(databaseVersions);
                form.change(BasicOptionsFields.databaseVersion, findDefaultDatabaseVersion(databaseVersions));
            }
            catch (e) {
                logger.error(e);
            }
            finally {
                setLoadingDatabaseVersions(false);
            }
        });
        if (!isOptionEmpty(databaseType) && !isOptionEmpty(kubernetesCluster)) {
            getDatabaseVersions();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [databaseType, kubernetesCluster]);
};
//# sourceMappingURL=DBClusterBasicOptions.hooks.js.map