import { useEffect, useState } from 'react';
import { usePrevious } from 'react-use';

import { PanelData } from '@grafana/data';
import { LinkButton } from '@grafana/ui';

import { AwsUrl, encodeUrl } from '../../../aws_url';
import { CloudWatchDatasource } from '../../../datasource';
import { CloudWatchLogsQuery } from '../../../types';

interface Props {
  query: CloudWatchLogsQuery;
  panelData?: PanelData;
  datasource: CloudWatchDatasource;
}

export function CloudWatchLink({ panelData, query, datasource }: Props) {
  const [href, setHref] = useState('');
  const prevPanelData = usePrevious<PanelData | undefined>(panelData);

  useEffect(() => {
    if (prevPanelData !== panelData && panelData?.request?.range) {
      const arns = (query.logGroups ?? [])
        .filter((group) => group?.arn)
        .map((group) => (group.arn ?? '').replace(/:\*$/, '')); // remove `:*` from end of arn
      const logGroupNames = query.logGroupNames;
      let sources = arns?.length ? arns : logGroupNames;

      const range = panelData?.request?.range;
      const start = range.from.toISOString();
      const end = range.to.toISOString();

      const urlProps: AwsUrl = {
        end,
        start,
        timeType: 'ABSOLUTE',
        tz: 'UTC',
        editorString: query.expression ?? '',
        isLiveTail: false,
        source: sources ?? [],
      };

      setHref(encodeUrl(urlProps, datasource.resources.getActualRegion(query.region)));
    }
  }, [panelData, prevPanelData, datasource, query]);

  return (
    <LinkButton variant="secondary" icon="share-alt" href={href} target="_blank" rel="noopener noreferrer">
      CloudWatch Logs Insights
    </LinkButton>
  );
}
