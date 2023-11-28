import { durationToMilliseconds, parseDuration } from '@grafana/data';
import { Severity } from 'app/percona/shared/core';
export const formatChannelsOptions = (channels) => channels
    ? channels.map((channel) => ({
        value: channel,
        label: channel,
    }))
    : [];
export const formatTemplateOptions = (templates) => templates
    ? templates.map((template) => ({
        value: template,
        label: template.summary,
    }))
    : [];
export const formatCreateAPIPayload = (data) => {
    var _a;
    const { duration, filters, ruleName, severity, template, folder, group } = data;
    const durationObj = parseDuration(duration);
    const durationSeconds = durationToMilliseconds(durationObj) / 1000;
    const payload = {
        custom_labels: {},
        filters: filters || [],
        for: `${durationSeconds}s`,
        severity: severity,
        template_name: template === null || template === void 0 ? void 0 : template.name,
        name: ruleName,
        params: [],
        group,
        folder_uid: (folder === null || folder === void 0 ? void 0 : folder.uid) || '',
    };
    (_a = template === null || template === void 0 ? void 0 : template.params) === null || _a === void 0 ? void 0 : _a.forEach((param) => {
        var _a;
        if (data.hasOwnProperty(param.name)) {
            const { name, type } = param;
            // @ts-ignore
            const value = data[param.name];
            (_a = payload.params) === null || _a === void 0 ? void 0 : _a.push({
                name,
                type,
                [type.toLowerCase()]: value,
            });
        }
    });
    return payload;
};
export const formatEditTemplate = (templateName, templateSummary) => ({
    value: templateName,
    label: templateSummary,
});
export const formatEditSeverity = (severity) => ({
    value: severity,
    label: Severity[severity],
});
export const formatEditNotificationChannel = (channel) => ({
    value: channel.channel_id,
    label: channel.summary,
});
export const formatEditNotificationChannels = (channels) => (channels ? channels.map(formatEditNotificationChannel) : []);
//# sourceMappingURL=TemplateStep.utils.js.map