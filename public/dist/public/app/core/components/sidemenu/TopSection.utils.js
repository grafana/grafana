import config from '../../config';
export const buildIntegratedAlertingMenuItem = (mainLinks) => {
    var _a;
    const integratedAlertingLink = {
        id: 'integrated-alerting',
        text: 'Integrated Alerting',
        icon: 'list-ul',
        url: `${config.appSubUrl}/integrated-alerting`,
    };
    const divider = {
        id: 'divider',
        text: 'Divider',
        divider: true,
        hideFromTabs: true,
    };
    const alertingIndex = mainLinks.findIndex(({ id }) => id === 'alerting');
    if (alertingIndex >= 0) {
        (_a = mainLinks[alertingIndex].children) === null || _a === void 0 ? void 0 : _a.unshift(integratedAlertingLink, divider);
    }
    return mainLinks;
};
//# sourceMappingURL=TopSection.utils.js.map