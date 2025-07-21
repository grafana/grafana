import { Trans, t } from '@grafana/i18n';
import { Button, Card, Text } from '@grafana/ui';

export type FilterProgressState = 'searching' | 'done' | 'aborted';
interface FilterStatusProps {
  numberOfRules: number;
  state: FilterProgressState;
  onCancel: () => void;
}

export function FilterStatus({ state, numberOfRules, onCancel }: FilterStatusProps) {
  return (
    <Card>
      <Text color="secondary">
        {/* done searching everything and found some results */}
        {state === 'done' && (
          <Trans i18nKey="alerting.rule-list.filter-view.no-more-results">
            No more results – found {{ numberOfRules }} rules
          </Trans>
        )}
        {/* user has cancelled the search */}
        {state === 'aborted' && (
          <Trans i18nKey="alerting.rule-list.filter-view.results-with-cancellation">
            Search cancelled – found {{ numberOfRules }} rules
          </Trans>
        )}
        {/* search is in progress */}
        {state === 'searching' && (
          <Trans i18nKey="alerting.rule-list.filter-view.results-loading">
            Searching – found {{ numberOfRules }} rules
          </Trans>
        )}
      </Text>
      {state === 'searching' && (
        <Button variant="secondary" size="sm" onClick={() => onCancel()}>
          {t('alerting.rule-list.filter-view.cancel-search', 'Cancel search')}
        </Button>
      )}
    </Card>
  );
}
