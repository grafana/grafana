import { Messages } from 'app/percona/settings/Settings.messages';
import { MetricsResolutionPresets } from './MetricsResolution.types';
const { metrics: { options }, } = Messages;
export const resolutionsOptions = [
    { value: MetricsResolutionPresets.rare, label: options.rare },
    { value: MetricsResolutionPresets.standard, label: options.standard },
    { value: MetricsResolutionPresets.frequent, label: options.frequent },
    { value: MetricsResolutionPresets.custom, label: options.custom },
];
export const defaultResolutions = [
    {
        hr: '60s',
        mr: '180s',
        lr: '300s',
    },
    {
        hr: '5s',
        mr: '10s',
        lr: '60s',
    },
    {
        hr: '1s',
        mr: '5s',
        lr: '30s',
    },
];
export const resolutionMin = 1;
export const resolutionMax = 1000000000;
//# sourceMappingURL=MetricsResolution.constants.js.map