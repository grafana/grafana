import { Tooltip } from '@grafana/ui';
import { Trans, t } from 'app/core/internationalization';

const UnknownContactPointDetails = ({ receiverName }: { receiverName?: string }) => (
  <span style={{ cursor: 'help' }}>
    <Tooltip
      content={t(
        'alerting.unknown-contact-point-details.unknown-contact-point-tooltip',
        'Details could not be found. This may be because you do not have access to the contact point'
      )}
    >
      <span>
        {receiverName ? (
          receiverName
        ) : (
          <Trans i18nKey="alerting.unknown-contact-point-details.unknown-contact-point">Unknown contact point</Trans>
        )}
      </span>
    </Tooltip>
  </span>
);

export default UnknownContactPointDetails;
