const JSURL = require('jsurl');
const defaultURL = 'console.aws.amazon.com';
const usGovURL = 'console.amazonaws-us-gov.com';
const chinaURL = 'console.amazonaws.cn';
export function getLogsEndpoint(region) {
    let url = defaultURL;
    if (region.startsWith('us-gov-')) {
        url = usGovURL;
    }
    if (region.startsWith('cn-')) {
        url = chinaURL;
    }
    return `${region}.${url}`;
}
export function encodeUrl(obj, region) {
    return `https://${getLogsEndpoint(region)}/cloudwatch/home?region=${region}#logs-insights:queryDetail=${JSURL.stringify(obj)}`;
}
//# sourceMappingURL=aws_url.js.map