import { Trans, t } from '@grafana/i18n';
import { Text } from '@grafana/ui';

import { REQUIRED_GROUP_BY_LABELS } from '../../constants';
import { GroupByField } from '../GroupByField/GroupByField';
import { OverrideSection } from '../OverrideSection/OverrideSection';

export interface GroupingOverrideProps {
  /** Plain label names; `undefined` or empty means "use the default grouping". */
  value: string[] | undefined;
  onChange: (value: string[] | undefined) => void;
  disabled?: boolean;
}

/** "Override grouping" switch plus the group-by field. Turning it on seeds the required labels, so the
 * field never starts empty (which would mean "group by nothing" rather than "the defaults plus more"). */
export function GroupingOverride({ value, onChange, disabled }: GroupingOverrideProps) {
  return (
    <OverrideSection
      label={t('alerting.grouping-override.label', 'Override grouping')}
      overridden={Boolean(value?.length)}
      onToggle={(on) => onChange(on ? REQUIRED_GROUP_BY_LABELS : undefined)}
      disabled={disabled}
      summary={
        <Text variant="body" color="secondary">
          <Trans i18nKey="alerting.grouping-override.summary" values={{ fields: REQUIRED_GROUP_BY_LABELS.join(', ') }}>
            Grouping: <strong>{'{{fields}}'}</strong>
          </Trans>
        </Text>
      }
    >
      <GroupByField value={value ?? []} onChange={onChange} disabled={disabled} />
    </OverrideSection>
  );
}
