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

export function encodeUrl(obj: AwsUrl, region: string): string {
  return `https://${region}.console.aws.amazon.com/cloudwatch/home?region=${region}#logs-insights:queryDetail=${JSURL.stringify(
    obj
  )}`;
}
