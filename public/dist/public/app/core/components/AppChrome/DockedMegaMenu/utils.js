import { locationUtil } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { t } from 'app/core/internationalization';
import { ShowModalReactEvent } from '../../../../types/events';
import appEvents from '../../../app_events';
import { getFooterLinks } from '../../Footer/Footer';
import { HelpModal } from '../../help/HelpModal';
export const enrichHelpItem = (helpItem) => {
    let menuItems = helpItem.children || [];
    if (helpItem.id === 'help') {
        const onOpenShortcuts = () => {
            appEvents.publish(new ShowModalReactEvent({ component: HelpModal }));
        };
        helpItem.children = [
            ...menuItems,
            ...getFooterLinks(),
            ...getEditionAndUpdateLinks(),
            {
                id: 'keyboard-shortcuts',
                text: t('nav.help/keyboard-shortcuts', 'Keyboard shortcuts'),
                icon: 'keyboard',
                onClick: onOpenShortcuts,
            },
        ];
    }
    return helpItem;
};
export const enrichWithInteractionTracking = (item, expandedState) => {
    // creating a new object here to not mutate the original item object
    const newItem = Object.assign({}, item);
    const onClick = newItem.onClick;
    newItem.onClick = () => {
        var _a;
        reportInteraction('grafana_navigation_item_clicked', {
            path: (_a = newItem.url) !== null && _a !== void 0 ? _a : newItem.id,
            state: expandedState ? 'expanded' : 'collapsed',
        });
        onClick === null || onClick === void 0 ? void 0 : onClick();
    };
    if (newItem.children) {
        newItem.children = newItem.children.map((item) => enrichWithInteractionTracking(item, expandedState));
    }
    return newItem;
};
export const isMatchOrChildMatch = (itemToCheck, searchItem) => {
    return Boolean(itemToCheck === searchItem || hasChildMatch(itemToCheck, searchItem));
};
export const hasChildMatch = (itemToCheck, searchItem) => {
    var _a;
    return Boolean((_a = itemToCheck.children) === null || _a === void 0 ? void 0 : _a.some((child) => {
        if (child === searchItem) {
            return true;
        }
        else {
            return hasChildMatch(child, searchItem);
        }
    }));
};
const stripQueryParams = (url) => {
    var _a;
    return (_a = url === null || url === void 0 ? void 0 : url.split('?')[0]) !== null && _a !== void 0 ? _a : '';
};
const isBetterMatch = (newMatch, currentMatch) => {
    const currentMatchUrl = stripQueryParams(currentMatch === null || currentMatch === void 0 ? void 0 : currentMatch.url);
    const newMatchUrl = stripQueryParams(newMatch.url);
    return newMatchUrl && newMatchUrl.length > (currentMatchUrl === null || currentMatchUrl === void 0 ? void 0 : currentMatchUrl.length);
};
export const getActiveItem = (navTree, pathname, currentBestMatch) => {
    const dashboardLinkMatch = '/dashboards';
    for (const link of navTree) {
        const linkWithoutParams = stripQueryParams(link.url);
        const linkPathname = locationUtil.stripBaseFromUrl(linkWithoutParams);
        if (linkPathname && link.id !== 'starred') {
            if (linkPathname === pathname) {
                // exact match
                currentBestMatch = link;
                break;
            }
            else if (linkPathname !== '/' && pathname.startsWith(linkPathname)) {
                // partial match
                if (isBetterMatch(link, currentBestMatch)) {
                    currentBestMatch = link;
                }
            }
            else if (linkPathname === '/alerting/list' && pathname.startsWith('/alerting/notification/')) {
                // alert channel match
                // TODO refactor routes such that we don't need this custom logic
                currentBestMatch = link;
                break;
            }
            else if (linkPathname === dashboardLinkMatch && pathname.startsWith('/d/')) {
                // dashboard match
                // TODO refactor routes such that we don't need this custom logic
                if (isBetterMatch(link, currentBestMatch)) {
                    currentBestMatch = link;
                }
            }
        }
        if (link.children) {
            currentBestMatch = getActiveItem(link.children, pathname, currentBestMatch);
        }
        if (stripQueryParams(currentBestMatch === null || currentBestMatch === void 0 ? void 0 : currentBestMatch.url) === pathname) {
            return currentBestMatch;
        }
    }
    return currentBestMatch;
};
export function getEditionAndUpdateLinks() {
    const { buildInfo, licenseInfo } = config;
    const stateInfo = licenseInfo.stateInfo ? ` (${licenseInfo.stateInfo})` : '';
    const links = [];
    links.push({
        target: '_blank',
        id: 'version',
        text: `${buildInfo.edition}${stateInfo}`,
        url: licenseInfo.licenseUrl,
        icon: 'external-link-alt',
    });
    if (buildInfo.hasUpdate) {
        links.push({
            target: '_blank',
            id: 'updateVersion',
            text: `New version available!`,
            icon: 'download-alt',
            url: 'https://grafana.com/grafana/download?utm_source=grafana_footer',
        });
    }
    return links;
}
//# sourceMappingURL=utils.js.map