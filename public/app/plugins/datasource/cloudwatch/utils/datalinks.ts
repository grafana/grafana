import { DataFrame, DataLink, DataQueryRequest, DataQueryResponse, ScopedVars, TimeRange } from '@grafana/data';
import { getDataSourceSrv } from '@grafana/runtime';

import { AwsUrl, encodeUrl } from '../aws_url';
import { CloudWatchLogsQuery, CloudWatchQuery } from '../types';

type ReplaceFn = (
  target?: string,
  scopedVars?: ScopedVars,
  displayErrorIfIsMultiTemplateVariable?: boolean,
  fieldName?: string
) => string;

export async function addDataLinksToLogsResponse(
  response: DataQueryResponse,
  request: DataQueryRequest<CloudWatchQuery>,
  range: TimeRange,
  replaceFn: ReplaceFn,
  getVariableValueFn: (value: string, scopedVars: ScopedVars) => string[],
  getRegion: (region: string) => string,
  tracingDatasourceUid?: string
): Promise<void> {
  const replace = (target: string, fieldName?: string) => replaceFn(target, request.scopedVars, false, fieldName);
  const getVariableValue = (target: string) => getVariableValueFn(target, request.scopedVars);

  for (const dataFrame of response.data as DataFrame[]) {
    const curTarget = request.targets.find((target) => target.refId === dataFrame.refId) as CloudWatchLogsQuery;
    const interpolatedRegion = getRegion(replace(curTarget.region ?? '', 'region'));

    for (const field of dataFrame.fields) {
      if (field.name === '@xrayTraceId' && tracingDatasourceUid) {
        getRegion(replace(curTarget.region ?? '', 'region'));
        const xrayLink = await createInternalXrayLink(tracingDatasourceUid, interpolatedRegion);
        if (xrayLink) {
          field.config.links = [xrayLink];
        }
      } else {
        // Right now we add generic link to open the query in xray console to every field so it shows in the logs row
        // details. Unfortunately this also creates link for all values inside table which look weird.
        field.config.links = [createAwsConsoleLink(curTarget, range, interpolatedRegion, replace, getVariableValue)];
      }
    }
  }
}

async function createInternalXrayLink(datasourceUid: string, region: string) {
  let ds;
  try {
    ds = await getDataSourceSrv().get(datasourceUid);
  } catch (e) {
    console.error('Could not load linked xray data source, it was probably deleted after it was linked', e);
    return undefined;
  }

  return {
    title: ds.name,
    url: '',
    internal: {
      query: { query: '${__value.raw}', queryType: 'getTrace', region: region },
      datasourceUid: datasourceUid,
      datasourceName: ds.name,
    },
  } as DataLink;
}

function createAwsConsoleLink(
  target: CloudWatchLogsQuery,
  range: TimeRange,
  region: string,
  replace: (target: string, fieldName?: string) => string,
  getVariableValue: (value: string) => string[]
) {
  const arns = (target.logGroups ?? [])
    .filter((group) => group?.arn)
    .map((group) => (group.arn ?? '').replace(/:\*$/, '')); // remove `:*` from end of arn
  const logGroupNames = target.logGroupNames ?? [];
  const sources = arns?.length ? arns : logGroupNames;
  const interpolatedExpression = target.expression ? replace(target.expression) : '';
  const interpolatedGroups = sources?.flatMap(getVariableValue);

  const urlProps: AwsUrl = {
    end: range.to.toISOString(),
    start: range.from.toISOString(),
    timeType: 'ABSOLUTE',
    tz: 'UTC',
    editorString: interpolatedExpression,
    isLiveTail: false,
    source: interpolatedGroups,
  };

  const encodedUrl = encodeUrl(urlProps, region);
  return {
    url: encodedUrl,
    title: 'View in CloudWatch console',
    targetBlank: true,
  };
}
