import { DataFrame, DataQueryRequest, DataQueryResponse, ScopedVars, TimeRange } from '@grafana/data';
import { CloudWatchLogsQuery, CloudWatchQuery } from '../types';
import { AwsUrl, encodeUrl } from '../aws_url';

type ReplaceFn = (
  target?: string,
  scopedVars?: ScopedVars,
  displayErrorIfIsMultiTemplateVariable?: boolean,
  fieldName?: string
) => string;

export function addDataLinksToLogsResponse(
  response: DataQueryResponse,
  request: DataQueryRequest<CloudWatchQuery>,
  range: TimeRange,
  replaceFn: ReplaceFn,
  getRegion: (region: string) => string
): void {
  const replace = (target: string, fieldName?: string) => replaceFn(target, request.scopedVars, true, fieldName);

  for (const dataFrame of response.data as DataFrame[]) {
    const curTarget = request.targets.find((target) => target.refId === dataFrame.refId) as CloudWatchLogsQuery;

    for (const field of dataFrame.fields) {
      if (field.name === 'xrayTraceId' && true /*config from data source*/) {
        // Create link to X-ray datasource
        // field.config.links = [createAwsConsoleLink(curTarget, range, replace, getRegion)];
      } else {
        // Right now we add generic link to open the query in xray console to every field so it shows in the logs row
        // details. Unfortunately this also creates link for all values inside table which look weird.
        field.config.links = [createAwsConsoleLink(curTarget, range, replace, getRegion)];
      }
    }
  }
}

function createAwsConsoleLink(
  target: CloudWatchLogsQuery,
  range: TimeRange,
  replace: (target: string, fieldName?: string) => string,
  getRegion: (region: string) => string
) {
  const interpolatedExpression = target.expression ? replace(target.expression) : '';
  const interpolatedGroups = target.logGroupNames?.map((logGroup: string) => replace(logGroup, 'log groups')) ?? [];
  const interpolatedRegion = getRegion(replace(target.region, 'region'));

  const urlProps: AwsUrl = {
    end: range.to.toISOString(),
    start: range.from.toISOString(),
    timeType: 'ABSOLUTE',
    tz: 'UTC',
    editorString: interpolatedExpression,
    isLiveTail: false,
    source: interpolatedGroups,
  };

  const encodedUrl = encodeUrl(urlProps, interpolatedRegion);
  return {
    url: encodedUrl,
    title: 'View in CloudWatch console',
    targetBlank: true,
  };
}
