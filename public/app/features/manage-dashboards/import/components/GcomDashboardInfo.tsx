import { dateTimeFormat } from '@grafana/data';
import { Trans } from '@grafana/i18n';
import { Box, Legend, TextLink } from '@grafana/ui';

type Props = {
  gnetId: string | number | undefined;
  orgName: string;
  updatedAt: string;
};

export function GcomDashboardInfo({ gnetId, orgName, updatedAt }: Props) {
  return (
    <Box marginBottom={3}>
      <div>
        <Legend>
          <Trans i18nKey="manage-dashboards.import-dashboard-overview-un-connected.importing-from">
            Importing dashboard from{' '}
            <TextLink href={`https://grafana.com/dashboards/${gnetId ?? ''}`}>Grafana.com</TextLink>
          </Trans>
        </Legend>
      </div>
      <table className="filter-table form-inline">
        <tbody>
          <tr>
            <td>
              <Trans i18nKey="manage-dashboards.import-dashboard-overview-un-connected.published-by">
                Published by
              </Trans>
            </td>
            <td>{orgName}</td>
          </tr>
          <tr>
            <td>
              <Trans i18nKey="manage-dashboards.import-dashboard-overview-un-connected.updated-on">Updated on</Trans>
            </td>
            <td>{dateTimeFormat(updatedAt)}</td>
          </tr>
        </tbody>
      </table>
    </Box>
  );
}
