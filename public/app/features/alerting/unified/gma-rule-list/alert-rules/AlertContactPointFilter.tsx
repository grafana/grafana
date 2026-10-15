import { ContactPointSelector, useListContactPoints } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';

interface AlertContactPointFilterProps {
  title?: string;
  disabled?: boolean;
  onChange: (title: string | undefined) => void;
}

/** The selector keys options by UID but criteria hold a title, so resolve title to UID. */
export function AlertContactPointFilter({ title, disabled, onChange }: AlertContactPointFilterProps) {
  const { currentData } = useListContactPoints();
  const uid = title
    ? currentData?.items.find((contactPoint) => contactPoint.spec.title === title)?.metadata.uid
    : undefined;

  return (
    <ContactPointSelector
      aria-label={t('alerting.gma-rule-list.search.property.contact-point', 'Contact point')}
      value={title ? (uid ?? title) : undefined}
      placeholder={t('alerting.gma-rule-list.search.contact-point-placeholder', 'Select contact point')}
      isClearable
      disabled={disabled}
      onChange={(contactPoint) => onChange(contactPoint?.spec.title)}
    />
  );
}
