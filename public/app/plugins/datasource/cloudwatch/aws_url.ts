const JSURL = require('jsurl');

export interface AwsUrl {
  end: string;
  start: string;
  timeType?: 'ABSOLUTE' | 'RELATIVE';
  tz?: 'local' | 'UTC';
  unit?: string;
  editorString: string;
  isLiveTail: boolean;
  source: string[];
}

const defaultURL = 'console.aws.amazon.com';
const usGovURL = 'console.amazonaws-us-gov.com';
const chinaURL = 'console.amazonaws.cn';

export function getLogsEndpoint(region: string): string {
  let url = defaultURL;
  if (region.startsWith('us-gov-')) {
    url = usGovURL;
  }
  if (region.startsWith('cn-')) {
    url = chinaURL;
  }
  return `${region}.${url}`;
}

export function encodeUrl(obj: AwsUrl, region: string): string {
  return `https://${getLogsEndpoint(
    region
  )}/cloudwatch/home?region=${region}#logs-insights:queryDetail=${JSURL.stringify(obj)}`;
}
