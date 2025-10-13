import { format } from 'date-fns';
import { enUS } from 'date-fns/locale';

export const formatDateWithTime = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${format(date.valueOf() + date.getTimezoneOffset() * 60 * 1000, 'MMMM dd, H:mm', { locale: enUS })} UTC`;
};

export const formatDateWithYear = (timestamp: string) => {
  const date = new Date(timestamp);
  return `${format(date.valueOf() + date.getTimezoneOffset() * 60 * 1000, 'MMMM dd, yyyy', { locale: enUS })} UTC`;
};
