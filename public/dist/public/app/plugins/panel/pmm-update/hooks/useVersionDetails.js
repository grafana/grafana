import { useEffect, useState } from 'react';
import { getCurrentVersion } from '../UpdatePanel.service';
import { formatDateWithYear, formatDateWithTime } from '../UpdatePanel.utils';
import { useApiCall } from '../hooks';
export const useVersionDetails = (initialForceUpdate = false) => {
    const [isDefaultView, setIsDefaultView] = useState(true);
    const [nextVersionDetails, setNextVersionDetails] = useState({
        nextVersion: '',
        nextFullVersion: '',
        nextVersionDate: '',
        newsLink: '',
    });
    const [installedVersionDetails, setInstalledVersionDetails] = useState({
        installedVersion: '',
        installedFullVersion: '',
        installedVersionDate: '',
    });
    const [lastCheckDate, setLastCheckDate] = useState('');
    const [isUpdateAvailable, setIsUpdateAvailable] = useState(false);
    const [data, errorMessage, isLoading, getVersionDetails] = useApiCall(getCurrentVersion, { force: initialForceUpdate }, { force: initialForceUpdate, onlyInstalledVersion: true });
    useEffect(() => {
        if (!data) {
            return;
        }
        const { last_check, latest = {
            full_version: undefined,
            timestamp: undefined,
            version: undefined,
        }, latest_news_url, installed, update_available, } = data;
        const { full_version: latestFullVersion, timestamp: latestTimestamp, version: latestVersion } = latest;
        const { full_version: installedFullVersion, timestamp: installedVersionTimestamp, version: installedVersion, } = installed;
        setNextVersionDetails({
            nextVersion: latestVersion !== null && latestVersion !== void 0 ? latestVersion : '',
            nextFullVersion: latestFullVersion !== null && latestFullVersion !== void 0 ? latestFullVersion : '',
            nextVersionDate: latestTimestamp ? formatDateWithYear(latestTimestamp) : '',
            newsLink: latest_news_url !== null && latest_news_url !== void 0 ? latest_news_url : '',
        });
        setInstalledVersionDetails({
            installedVersion: installedVersion !== null && installedVersion !== void 0 ? installedVersion : '',
            installedFullVersion: installedFullVersion !== null && installedFullVersion !== void 0 ? installedFullVersion : '',
            installedVersionDate: installedVersionTimestamp ? formatDateWithYear(installedVersionTimestamp) : '',
        });
        setLastCheckDate(last_check ? formatDateWithTime(last_check) : '');
        setIsUpdateAvailable(update_available !== null && update_available !== void 0 ? update_available : false);
        setIsDefaultView(false);
    }, [data]);
    return [
        {
            installedVersionDetails,
            lastCheckDate,
            nextVersionDetails,
            isUpdateAvailable,
        },
        errorMessage,
        isLoading,
        isDefaultView,
        getVersionDetails,
    ];
};
//# sourceMappingURL=useVersionDetails.js.map