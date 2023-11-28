import moment from 'moment/moment';
import { DAY_FORMAT, HOUR_FORMAT } from './BackupInventory.constants';
export const formatDate = (value) => {
    return moment(value).format(DAY_FORMAT + ' ' + HOUR_FORMAT);
};
//# sourceMappingURL=BackupInventory.utils.js.map