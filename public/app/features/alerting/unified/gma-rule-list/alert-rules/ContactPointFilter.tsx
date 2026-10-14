import { ContactPointSelector, useListContactPoints } from '@grafana/alerting/unstable';
import { t } from '@grafana/i18n';

interface ContactPointFilterProps {
  /** The applied contact point's title: criteria, the URL and saved searches all carry titles. */
  title?: string;
  disabled?: boolean;
  onChange: (title: string | undefined) => void;
}

/**
 * Contact point picker for the filter sidebar. The selector keys its options by UID while the
 * criteria hold a title, so the title is resolved to its UID for the selector to show the right
 * option as selected.
 */
export function ContactPointFilter({ title, disabled, onChange }: ContactPointFilterProps) {
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
