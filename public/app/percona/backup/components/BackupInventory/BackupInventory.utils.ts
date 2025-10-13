import moment from 'moment/moment';

import { DAY_FORMAT, HOUR_FORMAT } from './BackupInventory.constants';

export const formatDate = (value: string) => {
  return moment(value).format(DAY_FORMAT + ' ' + HOUR_FORMAT);
};
