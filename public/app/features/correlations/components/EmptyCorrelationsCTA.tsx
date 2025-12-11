import { Trans, t } from '@grafana/i18n';
import { Button, Card, EmptyState } from '@grafana/ui';

interface Props {
  onClick?: () => void;
  canWriteCorrelations: boolean;
}
export const EmptyCorrelationsCTA = ({ onClick, canWriteCorrelations }: Props) => {
  // TODO: if there are no datasources show a different message

  return canWriteCorrelations ? (
    <EmptyState
      variant="call-to-action"
      button={
        <Button icon="gf-glue" onClick={onClick} size="lg">
          <Trans i18nKey="correlations.empty-state.button-title">Add correlation</Trans>
        </Button>
      }
      message={t('correlations.empty-state.title', "You haven't defined any correlations yet")}
    >
      <Trans i18nKey="correlations.empty-state.pro-tip">
        You can also define correlations via datasource provisioning
      </Trans>
    </EmptyState>
  ) : (
    <Card noMargin>
      <Card.Heading>
        <Trans i18nKey="correlations.empty-correlations-cta.there-are-no-correlations-configured-yet">
          There are no correlations configured yet.
        </Trans>
      </Card.Heading>
      <Card.Description>
        <Trans i18nKey="correlations.empty-correlations-cta.please-contact-administrator-create-correlations">
          Please contact your administrator to create new correlations.
        </Trans>
      </Card.Description>
    </Card>
  );
};
