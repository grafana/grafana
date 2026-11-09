import { type SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';

export const getExpireOptions = () => {
  const DEFAULT_EXPIRE_OPTION: SelectableValue<number> = {
    label: t('share-modal.snapshot.expire-week', '1 Week'),
    value: 60 * 60 * 24 * 7,
  };

  return [
    {
      label: t('share-modal.snapshot.expire-hour', '1 Hour'),
      value: 60 * 60,
    },
    {
      label: t('share-modal.snapshot.expire-day', '1 Day'),
      value: 60 * 60 * 24,
    },
    DEFAULT_EXPIRE_OPTION,
    {
      label: t('share-modal.snapshot.expire-never', `Never`),
      value: 0,
    },
  ];
};
