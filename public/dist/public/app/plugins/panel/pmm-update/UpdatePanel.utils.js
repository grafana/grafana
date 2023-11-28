import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';
export const formatDateWithTime = (timestamp) => {
    const date = new Date(timestamp);
    return `${format(date.valueOf() + date.getTimezoneOffset() * 60 * 1000, 'MMMM dd, H:mm', { locale: enUS })} UTC`;
};
export const formatDateWithYear = (timestamp) => {
    const date = new Date(timestamp);
    return `${format(date.valueOf() + date.getTimezoneOffset() * 60 * 1000, 'MMMM dd, yyyy', { locale: enUS })} UTC`;
};
//# sourceMappingURL=UpdatePanel.utils.js.map