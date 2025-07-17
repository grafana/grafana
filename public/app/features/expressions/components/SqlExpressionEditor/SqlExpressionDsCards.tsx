import { SelectableValue } from '@grafana/data';
import { t } from '@grafana/i18n';
import { getDataSourceSrv } from '@grafana/runtime';
import { DataQuery } from '@grafana/schema';
import { Text, Card, Grid } from '@grafana/ui';
import icnDatasourceSvg from 'img/icn-datasource.svg';

interface SqlExpressionDsCardsProps {
  refIds: Array<SelectableValue<string>>;
  queries?: DataQuery[];
}

export const SqlExpressionDsCards = ({ refIds, queries }: SqlExpressionDsCardsProps) => {
  return (
    <Grid columns={4} gap={1}>
      {refIds.map(({ value: refIdValue, label: refIdLabel }) => {
        const query = queries?.find(({ refId: qRefId }) => qRefId === refIdValue);
        const dsSettings = query?.datasource ? getDataSourceSrv().getInstanceSettings(query.datasource) : null;
        const dsIcon = dsSettings?.meta?.info?.logos?.small || icnDatasourceSvg;
        const dsName = dsSettings?.name || dsSettings?.type || 'Unknown';

        return (
          <Card key={refIdValue} noMargin isCompact>
            <Card.Heading>
              <Text variant="code" color="maxContrast">
                {t('expressions.sql-drawer.query-label', '{{queryId}}', { queryId: refIdLabel })}
              </Text>
            </Card.Heading>
            <Card.Figure>
              <img src={dsIcon} alt={dsName} />
            </Card.Figure>
            <Card.Meta>{dsName}</Card.Meta>
          </Card>
        );
      })}
    </Grid>
  );
};
