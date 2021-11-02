var JSURL = require('jsurl');
export function encodeUrl(obj, region) {
    return "https://" + region + ".console.aws.amazon.com/cloudwatch/home?region=" + region + "#logs-insights:queryDetail=" + JSURL.stringify(obj);
}
//# sourceMappingURL=aws_url.js.map