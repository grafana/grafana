import { SelectableValue } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Icon, Label, RadioButtonGroup, Tooltip } from '@grafana/ui';
import { AlertState } from 'app/plugins/datasource/alertmanager/types';

interface Props {
  stateFilter?: AlertState;
  onStateFilterChange: (value: AlertState) => void;
}

export const AlertStateFilter = ({ onStateFilterChange, stateFilter }: Props) => {
  const alertStateOptions: SelectableValue[] = Object.entries(AlertState)
    .sort(([labelA], [labelB]) => (labelA < labelB ? -1 : 1))
    .map(([label, state]) => ({
      label,
      value: state,
    }));

  return (
    <div>
      <Label>
        <span>
          <Trans i18nKey="alerting.alert-state-filter.notification-state">Notification state</Trans>&nbsp;
        </span>
        <Tooltip
          content={
            <div>
              <ul>
                <li>
                  <Trans i18nKey="alerting.alert-state-filter.active-the-alert-is-firing">
                    Active: The alert notification has been handled. The alert is still firing and continues to be
                    managed.
                  </Trans>
                </li>
                <li>
                  <Trans i18nKey="alerting.alert-state-filter.suppressed-the-alert-has-been-silenced">
                    Suppressed: The alert has been silenced.
                  </Trans>
                </li>
                <li>
                  <Trans i18nKey="alerting.alert-state-filter.unprocessed-the-alert-is-received">
                    Unprocessed: The alert is received but its notification has not been processed yet.
                  </Trans>
                </li>
              </ul>
            </div>
          }
        >
          <Icon name="info-circle" size="sm" />
        </Tooltip>
      </Label>
      <RadioButtonGroup options={alertStateOptions} value={stateFilter} onChange={onStateFilterChange} />
    </div>
  );
};
