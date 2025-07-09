import { css, cx } from '@emotion/css';

import { dateTimeFormat, GrafanaTheme2, TimeZone } from '@grafana/data';
import { Trans, t } from '@grafana/i18n';
import { DeleteButton, Icon, Tooltip, useStyles2, useTheme2 } from '@grafana/ui';
import { ApiKey } from 'app/types/apiKeys';

interface Props {
  tokens: ApiKey[];
  timeZone: TimeZone;
  tokenActionsDisabled?: boolean;
  onDelete: (token: ApiKey) => void;
}

export const ServiceAccountTokensTable = ({ tokens, timeZone, tokenActionsDisabled, onDelete }: Props): JSX.Element => {
  const theme = useTheme2();

  const styles = getStyles(theme);

  return (
    <table className={cx(styles.section, 'filter-table')}>
      <thead>
        <tr>
          <th>
            <Trans i18nKey="serviceaccounts.service-account-tokens-table.name">Name</Trans>
          </th>
          <th>
            <Trans i18nKey="serviceaccounts.service-account-tokens-table.expires">Expires</Trans>
          </th>
          <th>
            <Trans i18nKey="serviceaccounts.service-account-tokens-table.created">Created</Trans>
          </th>
          <th>
            <Trans i18nKey="serviceaccounts.service-account-tokens-table.last-used-at">Last used at</Trans>
          </th>
          <th />
          <th />
        </tr>
      </thead>
      <tbody>
        {tokens.map((key) => {
          return (
            <tr key={key.id} className={styles.tableRow(key.hasExpired || key.isRevoked)}>
              <td>{key.name}</td>
              <td>
                <TokenExpiration timeZone={timeZone} token={key} />
              </td>
              <td>{formatDate(timeZone, key.created)}</td>
              <td>{formatLastUsedAtDate(timeZone, key.lastUsedAt)}</td>
              <td className="width-1 text-center">{key.isRevoked && <TokenRevoked />}</td>
              <td>
                <DeleteButton
                  aria-label={t(
                    'serviceaccounts.service-account-tokens-table.aria-label-delete-button',
                    'Delete service account token {{key}}',
                    { key: key.name }
                  )}
                  size="sm"
                  onConfirm={() => onDelete(key)}
                  disabled={tokenActionsDisabled}
                />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
};

function formatLastUsedAtDate(timeZone: TimeZone, lastUsedAt?: string): string {
  if (!lastUsedAt) {
    return 'Never';
  }
  return dateTimeFormat(lastUsedAt, { timeZone });
}

function formatDate(timeZone: TimeZone, expiration?: string): string {
  if (!expiration) {
    return 'No expiration date';
  }
  return dateTimeFormat(expiration, { timeZone });
}

function formatSecondsLeftUntilExpiration(secondsUntilExpiration: number): string {
  const days = Math.ceil(secondsUntilExpiration / (3600 * 24));
  const daysFormat = days > 1 ? `${days} days` : `${days} day`;
  return `Expires in ${daysFormat}`;
}

const TokenRevoked = () => {
  const styles = useStyles2(getStyles);

  return (
    <span className={styles.hasExpired}>
      <Trans i18nKey="serviceaccounts.token-revoked.revoked-label">Revoked</Trans>
      <span className={styles.tooltipContainer}>
        <Tooltip
          content={t(
            'serviceaccounts.token-revoked.content-token-publicly-exposed-please-rotate',
            'This token has been publicly exposed. Please rotate this token'
          )}
        >
          <Icon name="exclamation-triangle" className={styles.toolTipIcon} />
        </Tooltip>
      </span>
    </span>
  );
};

interface TokenExpirationProps {
  timeZone: TimeZone;
  token: ApiKey;
}

const TokenExpiration = ({ timeZone, token }: TokenExpirationProps) => {
  const styles = useStyles2(getStyles);

  if (!token.expiration) {
    return (
      <span className={styles.neverExpire}>
        <Trans i18nKey="serviceaccounts.token-expiration.never">Never</Trans>
      </span>
    );
  }
  if (token.secondsUntilExpiration) {
    return (
      <span className={styles.secondsUntilExpiration}>
        {formatSecondsLeftUntilExpiration(token.secondsUntilExpiration)}
      </span>
    );
  }
  if (token.hasExpired) {
    return (
      <span className={styles.hasExpired}>
        <Trans i18nKey="serviceaccounts.token-expiration.expired-label">Expired</Trans>
        <span className={styles.tooltipContainer}>
          <Tooltip
            content={t('serviceaccounts.token-expiration.content-this-token-has-expired', 'This token has expired')}
          >
            <Icon name="exclamation-triangle" className={styles.toolTipIcon} />
          </Tooltip>
        </span>
      </span>
    );
  }
  return <span>{formatDate(timeZone, token.expiration)}</span>;
};

const getStyles = (theme: GrafanaTheme2) => ({
  tableRow: (hasExpired: boolean | undefined) =>
    css({
      color: hasExpired ? theme.colors.text.secondary : theme.colors.text.primary,
    }),
  tooltipContainer: css({
    marginLeft: theme.spacing(1),
  }),
  toolTipIcon: css({
    color: theme.colors.error.text,
  }),
  secondsUntilExpiration: css({
    color: theme.colors.warning.text,
  }),
  hasExpired: css({
    color: theme.colors.error.text,
  }),
  neverExpire: css({
    color: theme.colors.text.secondary,
  }),
  section: css({
    marginBottom: theme.spacing(4),
  }),
});
