// AWS SDK for JavaScript v2.1.42
// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// License at https://sdk.amazonaws.com/js/BUNDLE_LICENSE.txt
(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
var AWS = require('./core');

AWS.apiLoader = function(svc, version) {
  return AWS.apiLoader.services[svc][version];
};


AWS.apiLoader.services = {};

AWS.XML.Parser = require('./xml/browser_parser');

require('./http/xhr');

if (typeof window !== 'undefined') window.AWS = AWS;
if (typeof module !== 'undefined') module.exports = AWS;
AWS.apiLoader.services['cloudwatch'] = {};
AWS.CloudWatch = AWS.Service.defineService('cloudwatch', [ '2010-08-01' ]);

AWS.apiLoader.services['cloudwatch']['2010-08-01'] = {"metadata":{"apiVersion":"2010-08-01","endpointPrefix":"monitoring","serviceAbbreviation":"CloudWatch","serviceFullName":"Amazon CloudWatch","signatureVersion":"v4","xmlNamespace":"http://monitoring.amazonaws.com/doc/2010-08-01/","protocol":"query"},"operations":{"DeleteAlarms":{"input":{"type":"structure","required":["AlarmNames"],"members":{"AlarmNames":{"shape":"S2"}}},"http":{}},"DescribeAlarmHistory":{"input":{"type":"structure","members":{"AlarmName":{},"HistoryItemType":{},"StartDate":{"type":"timestamp"},"EndDate":{"type":"timestamp"},"MaxRecords":{"type":"integer"},"NextToken":{}}},"output":{"resultWrapper":"DescribeAlarmHistoryResult","type":"structure","members":{"AlarmHistoryItems":{"type":"list","member":{"type":"structure","members":{"AlarmName":{},"Timestamp":{"type":"timestamp"},"HistoryItemType":{},"HistorySummary":{},"HistoryData":{}}}},"NextToken":{}}},"http":{}},"DescribeAlarms":{"input":{"type":"structure","members":{"AlarmNames":{"shape":"S2"},"AlarmNamePrefix":{},"StateValue":{},"ActionPrefix":{},"MaxRecords":{"type":"integer"},"NextToken":{}}},"output":{"resultWrapper":"DescribeAlarmsResult","type":"structure","members":{"MetricAlarms":{"shape":"Sj"},"NextToken":{}}},"http":{}},"DescribeAlarmsForMetric":{"input":{"type":"structure","required":["MetricName","Namespace"],"members":{"MetricName":{},"Namespace":{},"Statistic":{},"Dimensions":{"shape":"Sv"},"Period":{"type":"integer"},"Unit":{}}},"output":{"resultWrapper":"DescribeAlarmsForMetricResult","type":"structure","members":{"MetricAlarms":{"shape":"Sj"}}},"http":{}},"DisableAlarmActions":{"input":{"type":"structure","required":["AlarmNames"],"members":{"AlarmNames":{"shape":"S2"}}},"http":{}},"EnableAlarmActions":{"input":{"type":"structure","required":["AlarmNames"],"members":{"AlarmNames":{"shape":"S2"}}},"http":{}},"GetMetricStatistics":{"input":{"type":"structure","required":["Namespace","MetricName","StartTime","EndTime","Period","Statistics"],"members":{"Namespace":{},"MetricName":{},"Dimensions":{"shape":"Sv"},"StartTime":{"type":"timestamp"},"EndTime":{"type":"timestamp"},"Period":{"type":"integer"},"Statistics":{"type":"list","member":{}},"Unit":{}}},"output":{"resultWrapper":"GetMetricStatisticsResult","type":"structure","members":{"Label":{},"Datapoints":{"type":"list","member":{"type":"structure","members":{"Timestamp":{"type":"timestamp"},"SampleCount":{"type":"double"},"Average":{"type":"double"},"Sum":{"type":"double"},"Minimum":{"type":"double"},"Maximum":{"type":"double"},"Unit":{}},"xmlOrder":["Timestamp","SampleCount","Average","Sum","Minimum","Maximum","Unit"]}}}},"http":{}},"ListMetrics":{"input":{"type":"structure","members":{"Namespace":{},"MetricName":{},"Dimensions":{"type":"list","member":{"type":"structure","required":["Name"],"members":{"Name":{},"Value":{}}}},"NextToken":{}}},"output":{"xmlOrder":["Metrics","NextToken"],"resultWrapper":"ListMetricsResult","type":"structure","members":{"Metrics":{"type":"list","member":{"type":"structure","members":{"Namespace":{},"MetricName":{},"Dimensions":{"shape":"Sv"}},"xmlOrder":["Namespace","MetricName","Dimensions"]}},"NextToken":{}}},"http":{}},"PutMetricAlarm":{"input":{"type":"structure","required":["AlarmName","MetricName","Namespace","Statistic","Period","EvaluationPeriods","Threshold","ComparisonOperator"],"members":{"AlarmName":{},"AlarmDescription":{},"ActionsEnabled":{"type":"boolean"},"OKActions":{"shape":"So"},"AlarmActions":{"shape":"So"},"InsufficientDataActions":{"shape":"So"},"MetricName":{},"Namespace":{},"Statistic":{},"Dimensions":{"shape":"Sv"},"Period":{"type":"integer"},"Unit":{},"EvaluationPeriods":{"type":"integer"},"Threshold":{"type":"double"},"ComparisonOperator":{}}},"http":{}},"PutMetricData":{"input":{"type":"structure","required":["Namespace","MetricData"],"members":{"Namespace":{},"MetricData":{"type":"list","member":{"type":"structure","required":["MetricName"],"members":{"MetricName":{},"Dimensions":{"shape":"Sv"},"Timestamp":{"type":"timestamp"},"Value":{"type":"double"},"StatisticValues":{"type":"structure","required":["SampleCount","Sum","Minimum","Maximum"],"members":{"SampleCount":{"type":"double"},"Sum":{"type":"double"},"Minimum":{"type":"double"},"Maximum":{"type":"double"}}},"Unit":{}}}}}},"http":{}},"SetAlarmState":{"input":{"type":"structure","required":["AlarmName","StateValue","StateReason"],"members":{"AlarmName":{},"StateValue":{},"StateReason":{},"StateReasonData":{}}},"http":{}}},"shapes":{"S2":{"type":"list","member":{}},"Sj":{"type":"list","member":{"type":"structure","members":{"AlarmName":{},"AlarmArn":{},"AlarmDescription":{},"AlarmConfigurationUpdatedTimestamp":{"type":"timestamp"},"ActionsEnabled":{"type":"boolean"},"OKActions":{"shape":"So"},"AlarmActions":{"shape":"So"},"InsufficientDataActions":{"shape":"So"},"StateValue":{},"StateReason":{},"StateReasonData":{},"StateUpdatedTimestamp":{"type":"timestamp"},"MetricName":{},"Namespace":{},"Statistic":{},"Dimensions":{"shape":"Sv"},"Period":{"type":"integer"},"Unit":{},"EvaluationPeriods":{"type":"integer"},"Threshold":{"type":"double"},"ComparisonOperator":{}},"xmlOrder":["AlarmName","AlarmArn","AlarmDescription","AlarmConfigurationUpdatedTimestamp","ActionsEnabled","OKActions","AlarmActions","InsufficientDataActions","StateValue","StateReason","StateReasonData","StateUpdatedTimestamp","MetricName","Namespace","Statistic","Dimensions","Period","Unit","EvaluationPeriods","Threshold","ComparisonOperator"]}},"So":{"type":"list","member":{}},"Sv":{"type":"list","member":{"type":"structure","required":["Name","Value"],"members":{"Name":{},"Value":{}},"xmlOrder":["Name","Value"]}}},"paginators":{"DescribeAlarmHistory":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxRecords","result_key":"AlarmHistoryItems"},"DescribeAlarms":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxRecords","result_key":"MetricAlarms"},"DescribeAlarmsForMetric":{"result_key":"MetricAlarms"},"ListMetrics":{"input_token":"NextToken","output_token":"NextToken","result_key":"Metrics"}}};
AWS.apiLoader.services['cloudwatchlogs'] = {};
AWS.CloudWatchLogs = AWS.Service.defineService('cloudwatchlogs', [ '2014-03-28' ]);

AWS.apiLoader.services['cloudwatchlogs']['2014-03-28'] = {"version":"2.0","metadata":{"apiVersion":"2014-03-28","endpointPrefix":"logs","jsonVersion":"1.1","serviceFullName":"Amazon CloudWatch Logs","signatureVersion":"v4","targetPrefix":"Logs_20140328","protocol":"json"},"operations":{"CreateLogGroup":{"input":{"type":"structure","required":["logGroupName"],"members":{"logGroupName":{}}},"http":{}},"CreateLogStream":{"input":{"type":"structure","required":["logGroupName","logStreamName"],"members":{"logGroupName":{},"logStreamName":{}}},"http":{}},"DeleteDestination":{"input":{"type":"structure","required":["destinationName"],"members":{"destinationName":{}}},"http":{}},"DeleteLogGroup":{"input":{"type":"structure","required":["logGroupName"],"members":{"logGroupName":{}}},"http":{}},"DeleteLogStream":{"input":{"type":"structure","required":["logGroupName","logStreamName"],"members":{"logGroupName":{},"logStreamName":{}}},"http":{}},"DeleteMetricFilter":{"input":{"type":"structure","required":["logGroupName","filterName"],"members":{"logGroupName":{},"filterName":{}}},"http":{}},"DeleteRetentionPolicy":{"input":{"type":"structure","required":["logGroupName"],"members":{"logGroupName":{}}},"http":{}},"DeleteSubscriptionFilter":{"input":{"type":"structure","required":["logGroupName","filterName"],"members":{"logGroupName":{},"filterName":{}}},"http":{}},"DescribeDestinations":{"input":{"type":"structure","members":{"DestinationNamePrefix":{},"nextToken":{},"limit":{"type":"integer"}}},"output":{"type":"structure","members":{"destinations":{"type":"list","member":{"shape":"Si"}},"nextToken":{}}},"http":{}},"DescribeLogGroups":{"input":{"type":"structure","members":{"logGroupNamePrefix":{},"nextToken":{},"limit":{"type":"integer"}}},"output":{"type":"structure","members":{"logGroups":{"type":"list","member":{"type":"structure","members":{"logGroupName":{},"creationTime":{"type":"long"},"retentionInDays":{"type":"integer"},"metricFilterCount":{"type":"integer"},"arn":{},"storedBytes":{"type":"long"}}}},"nextToken":{}}},"http":{}},"DescribeLogStreams":{"input":{"type":"structure","required":["logGroupName"],"members":{"logGroupName":{},"logStreamNamePrefix":{},"orderBy":{},"descending":{"type":"boolean"},"nextToken":{},"limit":{"type":"integer"}}},"output":{"type":"structure","members":{"logStreams":{"type":"list","member":{"type":"structure","members":{"logStreamName":{},"creationTime":{"type":"long"},"firstEventTimestamp":{"type":"long"},"lastEventTimestamp":{"type":"long"},"lastIngestionTime":{"type":"long"},"uploadSequenceToken":{},"arn":{},"storedBytes":{"type":"long"}}}},"nextToken":{}}},"http":{}},"DescribeMetricFilters":{"input":{"type":"structure","required":["logGroupName"],"members":{"logGroupName":{},"filterNamePrefix":{},"nextToken":{},"limit":{"type":"integer"}}},"output":{"type":"structure","members":{"metricFilters":{"type":"list","member":{"type":"structure","members":{"filterName":{},"filterPattern":{},"metricTransformations":{"shape":"S17"},"creationTime":{"type":"long"}}}},"nextToken":{}}},"http":{}},"DescribeSubscriptionFilters":{"input":{"type":"structure","required":["logGroupName"],"members":{"logGroupName":{},"filterNamePrefix":{},"nextToken":{},"limit":{"type":"integer"}}},"output":{"type":"structure","members":{"subscriptionFilters":{"type":"list","member":{"type":"structure","members":{"filterName":{},"logGroupName":{},"filterPattern":{},"destinationArn":{},"roleArn":{},"creationTime":{"type":"long"}}}},"nextToken":{}}},"http":{}},"FilterLogEvents":{"input":{"type":"structure","required":["logGroupName"],"members":{"logGroupName":{},"logStreamNames":{"type":"list","member":{}},"startTime":{"type":"long"},"endTime":{"type":"long"},"filterPattern":{},"nextToken":{},"limit":{"type":"integer"},"interleaved":{"type":"boolean"}}},"output":{"type":"structure","members":{"events":{"type":"list","member":{"type":"structure","members":{"logStreamName":{},"timestamp":{"type":"long"},"message":{},"ingestionTime":{"type":"long"},"eventId":{}}}},"searchedLogStreams":{"type":"list","member":{"type":"structure","members":{"logStreamName":{},"searchedCompletely":{"type":"boolean"}}}},"nextToken":{}}},"http":{}},"GetLogEvents":{"input":{"type":"structure","required":["logGroupName","logStreamName"],"members":{"logGroupName":{},"logStreamName":{},"startTime":{"type":"long"},"endTime":{"type":"long"},"nextToken":{},"limit":{"type":"integer"},"startFromHead":{"type":"boolean"}}},"output":{"type":"structure","members":{"events":{"type":"list","member":{"type":"structure","members":{"timestamp":{"type":"long"},"message":{},"ingestionTime":{"type":"long"}}}},"nextForwardToken":{},"nextBackwardToken":{}}},"http":{}},"PutDestination":{"input":{"type":"structure","required":["destinationName","targetArn","roleArn"],"members":{"destinationName":{},"targetArn":{},"roleArn":{}}},"output":{"type":"structure","members":{"destination":{"shape":"Si"}}},"http":{}},"PutDestinationPolicy":{"input":{"type":"structure","required":["destinationName","accessPolicy"],"members":{"destinationName":{},"accessPolicy":{}}},"http":{}},"PutLogEvents":{"input":{"type":"structure","required":["logGroupName","logStreamName","logEvents"],"members":{"logGroupName":{},"logStreamName":{},"logEvents":{"type":"list","member":{"type":"structure","required":["timestamp","message"],"members":{"timestamp":{"type":"long"},"message":{}}}},"sequenceToken":{}}},"output":{"type":"structure","members":{"nextSequenceToken":{},"rejectedLogEventsInfo":{"type":"structure","members":{"tooNewLogEventStartIndex":{"type":"integer"},"tooOldLogEventEndIndex":{"type":"integer"},"expiredLogEventEndIndex":{"type":"integer"}}}}},"http":{}},"PutMetricFilter":{"input":{"type":"structure","required":["logGroupName","filterName","filterPattern","metricTransformations"],"members":{"logGroupName":{},"filterName":{},"filterPattern":{},"metricTransformations":{"shape":"S17"}}},"http":{}},"PutRetentionPolicy":{"input":{"type":"structure","required":["logGroupName","retentionInDays"],"members":{"logGroupName":{},"retentionInDays":{"type":"integer"}}},"http":{}},"PutSubscriptionFilter":{"input":{"type":"structure","required":["logGroupName","filterName","filterPattern","destinationArn"],"members":{"logGroupName":{},"filterName":{},"filterPattern":{},"destinationArn":{},"roleArn":{}}},"http":{}},"TestMetricFilter":{"input":{"type":"structure","required":["filterPattern","logEventMessages"],"members":{"filterPattern":{},"logEventMessages":{"type":"list","member":{}}}},"output":{"type":"structure","members":{"matches":{"type":"list","member":{"type":"structure","members":{"eventNumber":{"type":"long"},"eventMessage":{},"extractedValues":{"type":"map","key":{},"value":{}}}}}}},"http":{}}},"shapes":{"Si":{"type":"structure","members":{"destinationName":{},"targetArn":{},"roleArn":{},"accessPolicy":{},"arn":{},"creationTime":{"type":"long"}}},"S17":{"type":"list","member":{"type":"structure","required":["metricName","metricNamespace","metricValue"],"members":{"metricName":{},"metricNamespace":{},"metricValue":{}}}}},"examples":{},"paginators":{"DescribeLogGroups":{"input_token":"nextToken","output_token":"nextToken","limit_key":"limit","result_key":"logGroups"},"DescribeLogStreams":{"input_token":"nextToken","output_token":"nextToken","limit_key":"limit","result_key":"logStreams"},"DescribeMetricFilters":{"input_token":"nextToken","output_token":"nextToken","limit_key":"limit","result_key":"metricFilters"},"GetLogEvents":{"input_token":"nextToken","output_token":"nextForwardToken","limit_key":"limit","result_key":"events"}}};
AWS.apiLoader.services['cognitoidentity'] = {};
AWS.CognitoIdentity = AWS.Service.defineService('cognitoidentity', [ '2014-06-30' ]);
require('./services/cognitoidentity');

AWS.apiLoader.services['cognitoidentity']['2014-06-30'] = {"version":"2.0","metadata":{"apiVersion":"2014-06-30","endpointPrefix":"cognito-identity","jsonVersion":"1.1","serviceFullName":"Amazon Cognito Identity","signatureVersion":"v4","targetPrefix":"AWSCognitoIdentityService","protocol":"json"},"operations":{"CreateIdentityPool":{"input":{"type":"structure","required":["IdentityPoolName","AllowUnauthenticatedIdentities"],"members":{"IdentityPoolName":{},"AllowUnauthenticatedIdentities":{"type":"boolean"},"SupportedLoginProviders":{"shape":"S4"},"DeveloperProviderName":{},"OpenIdConnectProviderARNs":{"shape":"S8"}}},"output":{"shape":"Sa"},"http":{}},"DeleteIdentities":{"input":{"type":"structure","required":["IdentityIdsToDelete"],"members":{"IdentityIdsToDelete":{"type":"list","member":{}}}},"output":{"type":"structure","members":{"UnprocessedIdentityIds":{"type":"list","member":{"type":"structure","members":{"IdentityId":{},"ErrorCode":{}}}}}},"http":{}},"DeleteIdentityPool":{"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{}}},"http":{}},"DescribeIdentity":{"input":{"type":"structure","required":["IdentityId"],"members":{"IdentityId":{}}},"output":{"shape":"Sl"},"http":{}},"DescribeIdentityPool":{"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{}}},"output":{"shape":"Sa"},"http":{}},"GetCredentialsForIdentity":{"input":{"type":"structure","required":["IdentityId"],"members":{"IdentityId":{},"Logins":{"shape":"Sq"}}},"output":{"type":"structure","members":{"IdentityId":{},"Credentials":{"type":"structure","members":{"AccessKeyId":{},"SecretKey":{},"SessionToken":{},"Expiration":{"type":"timestamp"}}}}},"http":{}},"GetId":{"input":{"type":"structure","required":["IdentityPoolId"],"members":{"AccountId":{},"IdentityPoolId":{},"Logins":{"shape":"Sq"}}},"output":{"type":"structure","members":{"IdentityId":{}}},"http":{}},"GetIdentityPoolRoles":{"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{}}},"output":{"type":"structure","members":{"IdentityPoolId":{},"Roles":{"shape":"S12"}}},"http":{}},"GetOpenIdToken":{"input":{"type":"structure","required":["IdentityId"],"members":{"IdentityId":{},"Logins":{"shape":"Sq"}}},"output":{"type":"structure","members":{"IdentityId":{},"Token":{}}},"http":{}},"GetOpenIdTokenForDeveloperIdentity":{"input":{"type":"structure","required":["IdentityPoolId","Logins"],"members":{"IdentityPoolId":{},"IdentityId":{},"Logins":{"shape":"Sq"},"TokenDuration":{"type":"long"}}},"output":{"type":"structure","members":{"IdentityId":{},"Token":{}}},"http":{}},"ListIdentities":{"input":{"type":"structure","required":["IdentityPoolId","MaxResults"],"members":{"IdentityPoolId":{},"MaxResults":{"type":"integer"},"NextToken":{},"HideDisabled":{"type":"boolean"}}},"output":{"type":"structure","members":{"IdentityPoolId":{},"Identities":{"type":"list","member":{"shape":"Sl"}},"NextToken":{}}},"http":{}},"ListIdentityPools":{"input":{"type":"structure","required":["MaxResults"],"members":{"MaxResults":{"type":"integer"},"NextToken":{}}},"output":{"type":"structure","members":{"IdentityPools":{"type":"list","member":{"type":"structure","members":{"IdentityPoolId":{},"IdentityPoolName":{}}}},"NextToken":{}}},"http":{}},"LookupDeveloperIdentity":{"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{},"IdentityId":{},"DeveloperUserIdentifier":{},"MaxResults":{"type":"integer"},"NextToken":{}}},"output":{"type":"structure","members":{"IdentityId":{},"DeveloperUserIdentifierList":{"type":"list","member":{}},"NextToken":{}}},"http":{}},"MergeDeveloperIdentities":{"input":{"type":"structure","required":["SourceUserIdentifier","DestinationUserIdentifier","DeveloperProviderName","IdentityPoolId"],"members":{"SourceUserIdentifier":{},"DestinationUserIdentifier":{},"DeveloperProviderName":{},"IdentityPoolId":{}}},"output":{"type":"structure","members":{"IdentityId":{}}},"http":{}},"SetIdentityPoolRoles":{"input":{"type":"structure","required":["IdentityPoolId","Roles"],"members":{"IdentityPoolId":{},"Roles":{"shape":"S12"}}},"http":{}},"UnlinkDeveloperIdentity":{"input":{"type":"structure","required":["IdentityId","IdentityPoolId","DeveloperProviderName","DeveloperUserIdentifier"],"members":{"IdentityId":{},"IdentityPoolId":{},"DeveloperProviderName":{},"DeveloperUserIdentifier":{}}},"http":{}},"UnlinkIdentity":{"input":{"type":"structure","required":["IdentityId","Logins","LoginsToRemove"],"members":{"IdentityId":{},"Logins":{"shape":"Sq"},"LoginsToRemove":{"shape":"Sm"}}},"http":{}},"UpdateIdentityPool":{"input":{"shape":"Sa"},"output":{"shape":"Sa"},"http":{}}},"shapes":{"S4":{"type":"map","key":{},"value":{}},"S8":{"type":"list","member":{}},"Sa":{"type":"structure","required":["IdentityPoolId","IdentityPoolName","AllowUnauthenticatedIdentities"],"members":{"IdentityPoolId":{},"IdentityPoolName":{},"AllowUnauthenticatedIdentities":{"type":"boolean"},"SupportedLoginProviders":{"shape":"S4"},"DeveloperProviderName":{},"OpenIdConnectProviderARNs":{"shape":"S8"}}},"Sl":{"type":"structure","members":{"IdentityId":{},"Logins":{"shape":"Sm"},"CreationDate":{"type":"timestamp"},"LastModifiedDate":{"type":"timestamp"}}},"Sm":{"type":"list","member":{}},"Sq":{"type":"map","key":{},"value":{}},"S12":{"type":"map","key":{},"value":{}}}};
AWS.apiLoader.services['cognitosync'] = {};
AWS.CognitoSync = AWS.Service.defineService('cognitosync', [ '2014-06-30' ]);

AWS.apiLoader.services['cognitosync']['2014-06-30'] = {"version":"2.0","metadata":{"apiVersion":"2014-06-30","endpointPrefix":"cognito-sync","jsonVersion":"1.1","serviceFullName":"Amazon Cognito Sync","signatureVersion":"v4","protocol":"rest-json"},"operations":{"BulkPublish":{"http":{"requestUri":"/identitypools/{IdentityPoolId}/bulkpublish","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"}}},"output":{"type":"structure","members":{"IdentityPoolId":{}}}},"DeleteDataset":{"http":{"method":"DELETE","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"}}},"output":{"type":"structure","members":{"Dataset":{"shape":"S8"}}}},"DescribeDataset":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"}}},"output":{"type":"structure","members":{"Dataset":{"shape":"S8"}}}},"DescribeIdentityPoolUsage":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"}}},"output":{"type":"structure","members":{"IdentityPoolUsage":{"shape":"Sg"}}}},"DescribeIdentityUsage":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"}}},"output":{"type":"structure","members":{"IdentityUsage":{"type":"structure","members":{"IdentityId":{},"IdentityPoolId":{},"LastModifiedDate":{"type":"timestamp"},"DatasetCount":{"type":"integer"},"DataStorage":{"type":"long"}}}}}},"GetBulkPublishDetails":{"http":{"requestUri":"/identitypools/{IdentityPoolId}/getBulkPublishDetails","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"}}},"output":{"type":"structure","members":{"IdentityPoolId":{},"BulkPublishStartTime":{"type":"timestamp"},"BulkPublishCompleteTime":{"type":"timestamp"},"BulkPublishStatus":{},"FailureMessage":{}}}},"GetCognitoEvents":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/events","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"}}},"output":{"type":"structure","members":{"Events":{"shape":"Sq"}}}},"GetIdentityPoolConfiguration":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/configuration","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"}}},"output":{"type":"structure","members":{"IdentityPoolId":{},"PushSync":{"shape":"Sv"},"CognitoStreams":{"shape":"Sz"}}}},"ListDatasets":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets","responseCode":200},"input":{"type":"structure","required":["IdentityId","IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"NextToken":{"location":"querystring","locationName":"nextToken"},"MaxResults":{"location":"querystring","locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","members":{"Datasets":{"type":"list","member":{"shape":"S8"}},"Count":{"type":"integer"},"NextToken":{}}}},"ListIdentityPoolUsage":{"http":{"method":"GET","requestUri":"/identitypools","responseCode":200},"input":{"type":"structure","members":{"NextToken":{"location":"querystring","locationName":"nextToken"},"MaxResults":{"location":"querystring","locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","members":{"IdentityPoolUsages":{"type":"list","member":{"shape":"Sg"}},"MaxResults":{"type":"integer"},"Count":{"type":"integer"},"NextToken":{}}}},"ListRecords":{"http":{"method":"GET","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}/records","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"},"LastSyncCount":{"location":"querystring","locationName":"lastSyncCount","type":"long"},"NextToken":{"location":"querystring","locationName":"nextToken"},"MaxResults":{"location":"querystring","locationName":"maxResults","type":"integer"},"SyncSessionToken":{"location":"querystring","locationName":"syncSessionToken"}}},"output":{"type":"structure","members":{"Records":{"shape":"S1c"},"NextToken":{},"Count":{"type":"integer"},"DatasetSyncCount":{"type":"long"},"LastModifiedBy":{},"MergedDatasetNames":{"type":"list","member":{}},"DatasetExists":{"type":"boolean"},"DatasetDeletedAfterRequestedSyncCount":{"type":"boolean"},"SyncSessionToken":{}}}},"RegisterDevice":{"http":{"requestUri":"/identitypools/{IdentityPoolId}/identity/{IdentityId}/device","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","Platform","Token"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"Platform":{},"Token":{}}},"output":{"type":"structure","members":{"DeviceId":{}}}},"SetCognitoEvents":{"http":{"requestUri":"/identitypools/{IdentityPoolId}/events","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","Events"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"Events":{"shape":"Sq"}}}},"SetIdentityPoolConfiguration":{"http":{"requestUri":"/identitypools/{IdentityPoolId}/configuration","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"PushSync":{"shape":"Sv"},"CognitoStreams":{"shape":"Sz"}}},"output":{"type":"structure","members":{"IdentityPoolId":{},"PushSync":{"shape":"Sv"},"CognitoStreams":{"shape":"Sz"}}}},"SubscribeToDataset":{"http":{"requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}/subscriptions/{DeviceId}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName","DeviceId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"},"DeviceId":{"location":"uri","locationName":"DeviceId"}}},"output":{"type":"structure","members":{}}},"UnsubscribeFromDataset":{"http":{"method":"DELETE","requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}/subscriptions/{DeviceId}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName","DeviceId"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"},"DeviceId":{"location":"uri","locationName":"DeviceId"}}},"output":{"type":"structure","members":{}}},"UpdateRecords":{"http":{"requestUri":"/identitypools/{IdentityPoolId}/identities/{IdentityId}/datasets/{DatasetName}","responseCode":200},"input":{"type":"structure","required":["IdentityPoolId","IdentityId","DatasetName","SyncSessionToken"],"members":{"IdentityPoolId":{"location":"uri","locationName":"IdentityPoolId"},"IdentityId":{"location":"uri","locationName":"IdentityId"},"DatasetName":{"location":"uri","locationName":"DatasetName"},"DeviceId":{},"RecordPatches":{"type":"list","member":{"type":"structure","required":["Op","Key","SyncCount"],"members":{"Op":{},"Key":{},"Value":{},"SyncCount":{"type":"long"},"DeviceLastModifiedDate":{"type":"timestamp"}}}},"SyncSessionToken":{},"ClientContext":{"location":"header","locationName":"x-amz-Client-Context"}}},"output":{"type":"structure","members":{"Records":{"shape":"S1c"}}}}},"shapes":{"S8":{"type":"structure","members":{"IdentityId":{},"DatasetName":{},"CreationDate":{"type":"timestamp"},"LastModifiedDate":{"type":"timestamp"},"LastModifiedBy":{},"DataStorage":{"type":"long"},"NumRecords":{"type":"long"}}},"Sg":{"type":"structure","members":{"IdentityPoolId":{},"SyncSessionsCount":{"type":"long"},"DataStorage":{"type":"long"},"LastModifiedDate":{"type":"timestamp"}}},"Sq":{"type":"map","key":{},"value":{}},"Sv":{"type":"structure","members":{"ApplicationArns":{"type":"list","member":{}},"RoleArn":{}}},"Sz":{"type":"structure","members":{"StreamName":{},"RoleArn":{},"StreamingStatus":{}}},"S1c":{"type":"list","member":{"type":"structure","members":{"Key":{},"Value":{},"SyncCount":{"type":"long"},"LastModifiedDate":{"type":"timestamp"},"LastModifiedBy":{},"DeviceLastModifiedDate":{"type":"timestamp"}}}}}};
AWS.apiLoader.services['devicefarm'] = {};
AWS.DeviceFarm = AWS.Service.defineService('devicefarm', [ '2015-06-23' ]);

AWS.apiLoader.services['devicefarm']['2015-06-23'] = {"version":"2.0","metadata":{"apiVersion":"2015-06-23","endpointPrefix":"devicefarm","jsonVersion":"1.1","serviceFullName":"AWS Device Farm","signatureVersion":"v4","targetPrefix":"DeviceFarm_20150623","protocol":"json"},"operations":{"CreateDevicePool":{"input":{"type":"structure","required":["projectArn","name","rules"],"members":{"projectArn":{},"name":{},"description":{},"rules":{"shape":"S5"}}},"output":{"type":"structure","members":{"devicePool":{"shape":"Sb"}}},"http":{}},"CreateProject":{"input":{"type":"structure","required":["name"],"members":{"name":{}}},"output":{"type":"structure","members":{"project":{"shape":"Sf"}}},"http":{}},"CreateUpload":{"input":{"type":"structure","required":["projectArn","name","type"],"members":{"projectArn":{},"name":{},"type":{},"contentType":{}}},"output":{"type":"structure","members":{"upload":{"shape":"Sl"}}},"http":{}},"GetDevice":{"input":{"type":"structure","required":["arn"],"members":{"arn":{}}},"output":{"type":"structure","members":{"device":{"shape":"Sr"}}},"http":{}},"GetDevicePool":{"input":{"type":"structure","required":["arn"],"members":{"arn":{}}},"output":{"type":"structure","members":{"devicePool":{"shape":"Sb"}}},"http":{}},"GetDevicePoolCompatibility":{"input":{"type":"structure","required":["devicePoolArn","appArn"],"members":{"devicePoolArn":{},"appArn":{},"testType":{}}},"output":{"type":"structure","members":{"compatibleDevices":{"shape":"S14"},"incompatibleDevices":{"shape":"S14"}}},"http":{}},"GetJob":{"input":{"type":"structure","required":["arn"],"members":{"arn":{}}},"output":{"type":"structure","members":{"job":{"shape":"S1b"}}},"http":{}},"GetProject":{"input":{"type":"structure","required":["arn"],"members":{"arn":{}}},"output":{"type":"structure","members":{"project":{"shape":"Sf"}}},"http":{}},"GetRun":{"input":{"type":"structure","required":["arn"],"members":{"arn":{}}},"output":{"type":"structure","members":{"run":{"shape":"S1j"}}},"http":{}},"GetSuite":{"input":{"type":"structure","required":["arn"],"members":{"arn":{}}},"output":{"type":"structure","members":{"suite":{"shape":"S1m"}}},"http":{}},"GetTest":{"input":{"type":"structure","required":["arn"],"members":{"arn":{}}},"output":{"type":"structure","members":{"test":{"shape":"S1p"}}},"http":{}},"GetUpload":{"input":{"type":"structure","required":["arn"],"members":{"arn":{}}},"output":{"type":"structure","members":{"upload":{"shape":"Sl"}}},"http":{}},"ListArtifacts":{"input":{"type":"structure","required":["arn","type"],"members":{"arn":{},"type":{},"nextToken":{}}},"output":{"type":"structure","members":{"artifacts":{"type":"list","member":{"type":"structure","members":{"arn":{},"name":{},"type":{},"extension":{},"url":{}}}},"nextToken":{}}},"http":{}},"ListDevicePools":{"input":{"type":"structure","required":["arn"],"members":{"arn":{},"type":{},"nextToken":{}}},"output":{"type":"structure","members":{"devicePools":{"type":"list","member":{"shape":"Sb"}},"nextToken":{}}},"http":{}},"ListDevices":{"input":{"type":"structure","members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"devices":{"type":"list","member":{"shape":"Sr"}},"nextToken":{}}},"http":{}},"ListJobs":{"input":{"type":"structure","required":["arn"],"members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"jobs":{"type":"list","member":{"shape":"S1b"}},"nextToken":{}}},"http":{}},"ListProjects":{"input":{"type":"structure","members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"projects":{"type":"list","member":{"shape":"Sf"}},"nextToken":{}}},"http":{}},"ListRuns":{"input":{"type":"structure","required":["arn"],"members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"runs":{"type":"list","member":{"shape":"S1j"}},"nextToken":{}}},"http":{}},"ListSamples":{"input":{"type":"structure","required":["arn"],"members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"samples":{"type":"list","member":{"type":"structure","members":{"arn":{},"type":{},"url":{}}}},"nextToken":{}}},"http":{}},"ListSuites":{"input":{"type":"structure","required":["arn"],"members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"suites":{"type":"list","member":{"shape":"S1m"}},"nextToken":{}}},"http":{}},"ListTests":{"input":{"type":"structure","required":["arn"],"members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"tests":{"type":"list","member":{"shape":"S1p"}},"nextToken":{}}},"http":{}},"ListUniqueProblems":{"input":{"type":"structure","required":["arn"],"members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"uniqueProblems":{"type":"map","key":{},"value":{"type":"list","member":{"type":"structure","members":{"message":{},"problems":{"type":"list","member":{"type":"structure","members":{"run":{"shape":"S2w"},"job":{"shape":"S2w"},"suite":{"shape":"S2w"},"test":{"shape":"S2w"},"device":{"shape":"Sr"},"result":{},"message":{}}}}}}}},"nextToken":{}}},"http":{}},"ListUploads":{"input":{"type":"structure","required":["arn"],"members":{"arn":{},"nextToken":{}}},"output":{"type":"structure","members":{"uploads":{"type":"list","member":{"shape":"Sl"}},"nextToken":{}}},"http":{}},"ScheduleRun":{"input":{"type":"structure","required":["projectArn","appArn","devicePoolArn","test"],"members":{"projectArn":{},"appArn":{},"devicePoolArn":{},"name":{},"test":{"type":"structure","required":["type"],"members":{"type":{},"testPackageArn":{},"filter":{},"parameters":{"type":"map","key":{},"value":{}}}},"configuration":{"type":"structure","members":{"extraDataPackageArn":{},"networkProfileArn":{},"locale":{},"location":{"type":"structure","required":["latitude","longitude"],"members":{"latitude":{"type":"double"},"longitude":{"type":"double"}}},"radios":{"type":"structure","members":{"wifi":{"type":"boolean"},"bluetooth":{"type":"boolean"},"nfc":{"type":"boolean"},"gps":{"type":"boolean"}}},"auxiliaryApps":{"type":"list","member":{}}}}}},"output":{"type":"structure","members":{"run":{"shape":"S1j"}}},"http":{}}},"shapes":{"S5":{"type":"list","member":{"type":"structure","members":{"attribute":{},"operator":{},"value":{}}}},"Sb":{"type":"structure","members":{"arn":{},"name":{},"description":{},"type":{},"rules":{"shape":"S5"}}},"Sf":{"type":"structure","members":{"arn":{},"name":{},"created":{"type":"timestamp"}}},"Sl":{"type":"structure","members":{"arn":{},"name":{},"created":{"type":"timestamp"},"type":{},"status":{},"url":{},"metadata":{},"contentType":{},"message":{}}},"Sr":{"type":"structure","members":{"arn":{},"name":{},"manufacturer":{},"model":{},"formFactor":{},"platform":{},"os":{},"cpu":{"type":"structure","members":{"frequency":{},"architecture":{},"clock":{"type":"double"}}},"resolution":{"type":"structure","members":{"width":{"type":"integer"},"height":{"type":"integer"}}},"heapSize":{"type":"long"},"memory":{"type":"long"},"image":{},"carrier":{},"radio":{}}},"S14":{"type":"list","member":{"type":"structure","members":{"device":{"shape":"Sr"},"compatible":{"type":"boolean"},"incompatibilityMessages":{"type":"list","member":{"type":"structure","members":{"message":{},"type":{}}}}}}},"S1b":{"type":"structure","members":{"arn":{},"name":{},"type":{},"created":{"type":"timestamp"},"status":{},"result":{},"started":{"type":"timestamp"},"stopped":{"type":"timestamp"},"counters":{"shape":"S1e"},"message":{},"device":{"shape":"Sr"}}},"S1e":{"type":"structure","members":{"total":{"type":"integer"},"passed":{"type":"integer"},"failed":{"type":"integer"},"warned":{"type":"integer"},"errored":{"type":"integer"},"stopped":{"type":"integer"},"skipped":{"type":"integer"}}},"S1j":{"type":"structure","members":{"arn":{},"name":{},"type":{},"platform":{},"created":{"type":"timestamp"},"status":{},"result":{},"started":{"type":"timestamp"},"stopped":{"type":"timestamp"},"counters":{"shape":"S1e"},"message":{},"totalJobs":{"type":"integer"},"completedJobs":{"type":"integer"}}},"S1m":{"type":"structure","members":{"arn":{},"name":{},"type":{},"created":{"type":"timestamp"},"status":{},"result":{},"started":{"type":"timestamp"},"stopped":{"type":"timestamp"},"counters":{"shape":"S1e"},"message":{}}},"S1p":{"type":"structure","members":{"arn":{},"name":{},"type":{},"created":{"type":"timestamp"},"status":{},"result":{},"started":{"type":"timestamp"},"stopped":{"type":"timestamp"},"counters":{"shape":"S1e"},"message":{}}},"S2w":{"type":"structure","members":{"arn":{},"name":{}}}},"examples":{},"paginators":{"ListArtifacts":{"input_token":"nextToken","output_token":"nextToken","result_key":"artifacts"},"ListDevicePools":{"input_token":"nextToken","output_token":"nextToken","result_key":"devicePools"},"ListDevices":{"input_token":"nextToken","output_token":"nextToken","result_key":"devices"},"ListJobs":{"input_token":"nextToken","output_token":"nextToken","result_key":"jobs"},"ListProjects":{"input_token":"nextToken","output_token":"nextToken","result_key":"projects"},"ListRuns":{"input_token":"nextToken","output_token":"nextToken","result_key":"runs"},"ListSamples":{"input_token":"nextToken","output_token":"nextToken","result_key":"samples"},"ListSuites":{"input_token":"nextToken","output_token":"nextToken","result_key":"suites"},"ListTests":{"input_token":"nextToken","output_token":"nextToken","result_key":"tests"},"ListUniqueProblems":{"input_token":"nextToken","output_token":"nextToken","result_key":"uniqueProblems"},"ListUploads":{"input_token":"nextToken","output_token":"nextToken","result_key":"uploads"}}};
AWS.apiLoader.services['dynamodb'] = {};
AWS.DynamoDB = AWS.Service.defineService('dynamodb', [ '2011-12-05', '2012-08-10' ]);
require('./services/dynamodb');

AWS.apiLoader.services['dynamodb']['2012-08-10'] = {"version":"2.0","metadata":{"apiVersion":"2012-08-10","endpointPrefix":"dynamodb","jsonVersion":"1.0","serviceAbbreviation":"DynamoDB","serviceFullName":"Amazon DynamoDB","signatureVersion":"v4","targetPrefix":"DynamoDB_20120810","protocol":"json"},"operations":{"BatchGetItem":{"input":{"type":"structure","required":["RequestItems"],"members":{"RequestItems":{"shape":"S2"},"ReturnConsumedCapacity":{}}},"output":{"type":"structure","members":{"Responses":{"type":"map","key":{},"value":{"shape":"Sr"}},"UnprocessedKeys":{"shape":"S2"},"ConsumedCapacity":{"shape":"St"}}},"http":{}},"BatchWriteItem":{"input":{"type":"structure","required":["RequestItems"],"members":{"RequestItems":{"shape":"S10"},"ReturnConsumedCapacity":{},"ReturnItemCollectionMetrics":{}}},"output":{"type":"structure","members":{"UnprocessedItems":{"shape":"S10"},"ItemCollectionMetrics":{"type":"map","key":{},"value":{"type":"list","member":{"shape":"S1a"}}},"ConsumedCapacity":{"shape":"St"}}},"http":{}},"CreateTable":{"input":{"type":"structure","required":["AttributeDefinitions","TableName","KeySchema","ProvisionedThroughput"],"members":{"AttributeDefinitions":{"shape":"S1f"},"TableName":{},"KeySchema":{"shape":"S1j"},"LocalSecondaryIndexes":{"type":"list","member":{"type":"structure","required":["IndexName","KeySchema","Projection"],"members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"}}}},"GlobalSecondaryIndexes":{"type":"list","member":{"type":"structure","required":["IndexName","KeySchema","Projection","ProvisionedThroughput"],"members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"},"ProvisionedThroughput":{"shape":"S1u"}}}},"ProvisionedThroughput":{"shape":"S1u"},"StreamSpecification":{"shape":"S1w"}}},"output":{"type":"structure","members":{"TableDescription":{"shape":"S20"}}},"http":{}},"DeleteItem":{"input":{"type":"structure","required":["TableName","Key"],"members":{"TableName":{},"Key":{"shape":"S6"},"Expected":{"shape":"S2e"},"ConditionalOperator":{},"ReturnValues":{},"ReturnConsumedCapacity":{},"ReturnItemCollectionMetrics":{},"ConditionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2m"}}},"output":{"type":"structure","members":{"Attributes":{"shape":"Ss"},"ConsumedCapacity":{"shape":"Su"},"ItemCollectionMetrics":{"shape":"S1a"}}},"http":{}},"DeleteTable":{"input":{"type":"structure","required":["TableName"],"members":{"TableName":{}}},"output":{"type":"structure","members":{"TableDescription":{"shape":"S20"}}},"http":{}},"DescribeTable":{"input":{"type":"structure","required":["TableName"],"members":{"TableName":{}}},"output":{"type":"structure","members":{"Table":{"shape":"S20"}}},"http":{}},"GetItem":{"input":{"type":"structure","required":["TableName","Key"],"members":{"TableName":{},"Key":{"shape":"S6"},"AttributesToGet":{"shape":"Sj"},"ConsistentRead":{"type":"boolean"},"ReturnConsumedCapacity":{},"ProjectionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"}}},"output":{"type":"structure","members":{"Item":{"shape":"Ss"},"ConsumedCapacity":{"shape":"Su"}}},"http":{}},"ListTables":{"input":{"type":"structure","members":{"ExclusiveStartTableName":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","members":{"TableNames":{"type":"list","member":{}},"LastEvaluatedTableName":{}}},"http":{}},"PutItem":{"input":{"type":"structure","required":["TableName","Item"],"members":{"TableName":{},"Item":{"shape":"S14"},"Expected":{"shape":"S2e"},"ReturnValues":{},"ReturnConsumedCapacity":{},"ReturnItemCollectionMetrics":{},"ConditionalOperator":{},"ConditionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2m"}}},"output":{"type":"structure","members":{"Attributes":{"shape":"Ss"},"ConsumedCapacity":{"shape":"Su"},"ItemCollectionMetrics":{"shape":"S1a"}}},"http":{}},"Query":{"input":{"type":"structure","required":["TableName"],"members":{"TableName":{},"IndexName":{},"Select":{},"AttributesToGet":{"shape":"Sj"},"Limit":{"type":"integer"},"ConsistentRead":{"type":"boolean"},"KeyConditions":{"type":"map","key":{},"value":{"shape":"S35"}},"QueryFilter":{"shape":"S36"},"ConditionalOperator":{},"ScanIndexForward":{"type":"boolean"},"ExclusiveStartKey":{"shape":"S6"},"ReturnConsumedCapacity":{},"ProjectionExpression":{},"FilterExpression":{},"KeyConditionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2m"}}},"output":{"type":"structure","members":{"Items":{"shape":"Sr"},"Count":{"type":"integer"},"ScannedCount":{"type":"integer"},"LastEvaluatedKey":{"shape":"S6"},"ConsumedCapacity":{"shape":"Su"}}},"http":{}},"Scan":{"input":{"type":"structure","required":["TableName"],"members":{"TableName":{},"IndexName":{},"AttributesToGet":{"shape":"Sj"},"Limit":{"type":"integer"},"Select":{},"ScanFilter":{"shape":"S36"},"ConditionalOperator":{},"ExclusiveStartKey":{"shape":"S6"},"ReturnConsumedCapacity":{},"TotalSegments":{"type":"integer"},"Segment":{"type":"integer"},"ProjectionExpression":{},"FilterExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2m"},"ConsistentRead":{"type":"boolean"}}},"output":{"type":"structure","members":{"Items":{"shape":"Sr"},"Count":{"type":"integer"},"ScannedCount":{"type":"integer"},"LastEvaluatedKey":{"shape":"S6"},"ConsumedCapacity":{"shape":"Su"}}},"http":{}},"UpdateItem":{"input":{"type":"structure","required":["TableName","Key"],"members":{"TableName":{},"Key":{"shape":"S6"},"AttributeUpdates":{"type":"map","key":{},"value":{"type":"structure","members":{"Value":{"shape":"S8"},"Action":{}}}},"Expected":{"shape":"S2e"},"ConditionalOperator":{},"ReturnValues":{},"ReturnConsumedCapacity":{},"ReturnItemCollectionMetrics":{},"UpdateExpression":{},"ConditionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"},"ExpressionAttributeValues":{"shape":"S2m"}}},"output":{"type":"structure","members":{"Attributes":{"shape":"Ss"},"ConsumedCapacity":{"shape":"Su"},"ItemCollectionMetrics":{"shape":"S1a"}}},"http":{}},"UpdateTable":{"input":{"type":"structure","required":["TableName"],"members":{"AttributeDefinitions":{"shape":"S1f"},"TableName":{},"ProvisionedThroughput":{"shape":"S1u"},"GlobalSecondaryIndexUpdates":{"type":"list","member":{"type":"structure","members":{"Update":{"type":"structure","required":["IndexName","ProvisionedThroughput"],"members":{"IndexName":{},"ProvisionedThroughput":{"shape":"S1u"}}},"Create":{"type":"structure","required":["IndexName","KeySchema","Projection","ProvisionedThroughput"],"members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"},"ProvisionedThroughput":{"shape":"S1u"}}},"Delete":{"type":"structure","required":["IndexName"],"members":{"IndexName":{}}}}}},"StreamSpecification":{"shape":"S1w"}}},"output":{"type":"structure","members":{"TableDescription":{"shape":"S20"}}},"http":{}}},"shapes":{"S2":{"type":"map","key":{},"value":{"type":"structure","required":["Keys"],"members":{"Keys":{"type":"list","member":{"shape":"S6"}},"AttributesToGet":{"shape":"Sj"},"ConsistentRead":{"type":"boolean"},"ProjectionExpression":{},"ExpressionAttributeNames":{"shape":"Sm"}}}},"S6":{"type":"map","key":{},"value":{"shape":"S8"}},"S8":{"type":"structure","members":{"S":{},"N":{},"B":{"type":"blob"},"SS":{"type":"list","member":{}},"NS":{"type":"list","member":{}},"BS":{"type":"list","member":{"type":"blob"}},"M":{"type":"map","key":{},"value":{"shape":"S8"}},"L":{"type":"list","member":{"shape":"S8"}},"NULL":{"type":"boolean"},"BOOL":{"type":"boolean"}}},"Sj":{"type":"list","member":{}},"Sm":{"type":"map","key":{},"value":{}},"Sr":{"type":"list","member":{"shape":"Ss"}},"Ss":{"type":"map","key":{},"value":{"shape":"S8"}},"St":{"type":"list","member":{"shape":"Su"}},"Su":{"type":"structure","members":{"TableName":{},"CapacityUnits":{"type":"double"},"Table":{"shape":"Sw"},"LocalSecondaryIndexes":{"shape":"Sx"},"GlobalSecondaryIndexes":{"shape":"Sx"}}},"Sw":{"type":"structure","members":{"CapacityUnits":{"type":"double"}}},"Sx":{"type":"map","key":{},"value":{"shape":"Sw"}},"S10":{"type":"map","key":{},"value":{"type":"list","member":{"type":"structure","members":{"PutRequest":{"type":"structure","required":["Item"],"members":{"Item":{"shape":"S14"}}},"DeleteRequest":{"type":"structure","required":["Key"],"members":{"Key":{"shape":"S6"}}}}}}},"S14":{"type":"map","key":{},"value":{"shape":"S8"}},"S1a":{"type":"structure","members":{"ItemCollectionKey":{"type":"map","key":{},"value":{"shape":"S8"}},"SizeEstimateRangeGB":{"type":"list","member":{"type":"double"}}}},"S1f":{"type":"list","member":{"type":"structure","required":["AttributeName","AttributeType"],"members":{"AttributeName":{},"AttributeType":{}}}},"S1j":{"type":"list","member":{"type":"structure","required":["AttributeName","KeyType"],"members":{"AttributeName":{},"KeyType":{}}}},"S1o":{"type":"structure","members":{"ProjectionType":{},"NonKeyAttributes":{"type":"list","member":{}}}},"S1u":{"type":"structure","required":["ReadCapacityUnits","WriteCapacityUnits"],"members":{"ReadCapacityUnits":{"type":"long"},"WriteCapacityUnits":{"type":"long"}}},"S1w":{"type":"structure","members":{"StreamEnabled":{"type":"boolean"},"StreamViewType":{}}},"S20":{"type":"structure","members":{"AttributeDefinitions":{"shape":"S1f"},"TableName":{},"KeySchema":{"shape":"S1j"},"TableStatus":{},"CreationDateTime":{"type":"timestamp"},"ProvisionedThroughput":{"shape":"S23"},"TableSizeBytes":{"type":"long"},"ItemCount":{"type":"long"},"TableArn":{},"LocalSecondaryIndexes":{"type":"list","member":{"type":"structure","members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"},"IndexSizeBytes":{"type":"long"},"ItemCount":{"type":"long"},"IndexArn":{}}}},"GlobalSecondaryIndexes":{"type":"list","member":{"type":"structure","members":{"IndexName":{},"KeySchema":{"shape":"S1j"},"Projection":{"shape":"S1o"},"IndexStatus":{},"Backfilling":{"type":"boolean"},"ProvisionedThroughput":{"shape":"S23"},"IndexSizeBytes":{"type":"long"},"ItemCount":{"type":"long"},"IndexArn":{}}}},"StreamSpecification":{"shape":"S1w"},"LatestStreamLabel":{},"LatestStreamArn":{}}},"S23":{"type":"structure","members":{"LastIncreaseDateTime":{"type":"timestamp"},"LastDecreaseDateTime":{"type":"timestamp"},"NumberOfDecreasesToday":{"type":"long"},"ReadCapacityUnits":{"type":"long"},"WriteCapacityUnits":{"type":"long"}}},"S2e":{"type":"map","key":{},"value":{"type":"structure","members":{"Value":{"shape":"S8"},"Exists":{"type":"boolean"},"ComparisonOperator":{},"AttributeValueList":{"shape":"S2i"}}}},"S2i":{"type":"list","member":{"shape":"S8"}},"S2m":{"type":"map","key":{},"value":{"shape":"S8"}},"S35":{"type":"structure","required":["ComparisonOperator"],"members":{"AttributeValueList":{"shape":"S2i"},"ComparisonOperator":{}}},"S36":{"type":"map","key":{},"value":{"shape":"S35"}}},"examples":{},"paginators":{"BatchGetItem":{"input_token":"RequestItems","output_token":"UnprocessedKeys"},"ListTables":{"input_token":"ExclusiveStartTableName","output_token":"LastEvaluatedTableName","limit_key":"Limit","result_key":"TableNames"},"Query":{"input_token":"ExclusiveStartKey","output_token":"LastEvaluatedKey","limit_key":"Limit","result_key":"Items"},"Scan":{"input_token":"ExclusiveStartKey","output_token":"LastEvaluatedKey","limit_key":"Limit","result_key":"Items"}},"waiters":{"__default__":{"interval":20,"max_attempts":25},"__TableState":{"operation":"DescribeTable"},"TableExists":{"extends":"__TableState","ignore_errors":["ResourceNotFoundException"],"success_type":"output","success_path":"Table.TableStatus","success_value":"ACTIVE"},"TableNotExists":{"extends":"__TableState","success_type":"error","success_value":"ResourceNotFoundException"}}};
AWS.apiLoader.services['dynamodbstreams'] = {};
AWS.DynamoDBStreams = AWS.Service.defineService('dynamodbstreams', [ '2012-08-10' ]);

AWS.apiLoader.services['dynamodbstreams']['2012-08-10'] = {"version":"2.0","metadata":{"apiVersion":"2012-08-10","endpointPrefix":"streams.dynamodb","jsonVersion":"1.0","serviceFullName":"Amazon DynamoDB Streams","signatureVersion":"v4","signingName":"dynamodb","targetPrefix":"DynamoDBStreams_20120810","protocol":"json"},"operations":{"DescribeStream":{"input":{"type":"structure","required":["StreamArn"],"members":{"StreamArn":{},"Limit":{"type":"integer"},"ExclusiveStartShardId":{}}},"output":{"type":"structure","members":{"StreamDescription":{"type":"structure","members":{"StreamArn":{},"StreamLabel":{},"StreamStatus":{},"StreamViewType":{},"CreationRequestDateTime":{"type":"timestamp"},"TableName":{},"KeySchema":{"type":"list","member":{"type":"structure","required":["AttributeName","KeyType"],"members":{"AttributeName":{},"KeyType":{}}}},"Shards":{"type":"list","member":{"type":"structure","members":{"ShardId":{},"SequenceNumberRange":{"type":"structure","members":{"StartingSequenceNumber":{},"EndingSequenceNumber":{}}},"ParentShardId":{}}}},"LastEvaluatedShardId":{}}}}},"http":{}},"GetRecords":{"input":{"type":"structure","required":["ShardIterator"],"members":{"ShardIterator":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","members":{"Records":{"type":"list","member":{"type":"structure","members":{"eventID":{},"eventName":{},"eventVersion":{},"eventSource":{},"awsRegion":{},"dynamodb":{"type":"structure","members":{"Keys":{"shape":"Sr"},"NewImage":{"shape":"Sr"},"OldImage":{"shape":"Sr"},"SequenceNumber":{},"SizeBytes":{"type":"long"},"StreamViewType":{}}}}}},"NextShardIterator":{}}},"http":{}},"GetShardIterator":{"input":{"type":"structure","required":["StreamArn","ShardId","ShardIteratorType"],"members":{"StreamArn":{},"ShardId":{},"ShardIteratorType":{},"SequenceNumber":{}}},"output":{"type":"structure","members":{"ShardIterator":{}}},"http":{}},"ListStreams":{"input":{"type":"structure","members":{"TableName":{},"Limit":{"type":"integer"},"ExclusiveStartStreamArn":{}}},"output":{"type":"structure","members":{"Streams":{"type":"list","member":{"type":"structure","members":{"StreamArn":{},"TableName":{},"StreamLabel":{}}}},"LastEvaluatedStreamArn":{}}},"http":{}}},"shapes":{"Sr":{"type":"map","key":{},"value":{"shape":"St"}},"St":{"type":"structure","members":{"S":{},"N":{},"B":{"type":"blob"},"SS":{"type":"list","member":{}},"NS":{"type":"list","member":{}},"BS":{"type":"list","member":{"type":"blob"}},"M":{"type":"map","key":{},"value":{"shape":"St"}},"L":{"type":"list","member":{"shape":"St"}},"NULL":{"type":"boolean"},"BOOL":{"type":"boolean"}}}},"examples":{}};
AWS.apiLoader.services['ec2'] = {};
AWS.EC2 = AWS.Service.defineService('ec2', [ '2015-04-15' ]);
require('./services/ec2');

AWS.apiLoader.services['ec2']['2015-04-15'] = {"version":"2.0","metadata":{"apiVersion":"2015-04-15","endpointPrefix":"ec2","serviceAbbreviation":"Amazon EC2","serviceFullName":"Amazon Elastic Compute Cloud","signatureVersion":"v4","xmlNamespace":"http://ec2.amazonaws.com/doc/2015-04-15","protocol":"ec2"},"operations":{"AcceptVpcPeeringConnection":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcPeeringConnectionId":{"locationName":"vpcPeeringConnectionId"}}},"output":{"type":"structure","members":{"VpcPeeringConnection":{"shape":"S5","locationName":"vpcPeeringConnection"}}},"http":{}},"AllocateAddress":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Domain":{}}},"output":{"type":"structure","members":{"PublicIp":{"locationName":"publicIp"},"Domain":{"locationName":"domain"},"AllocationId":{"locationName":"allocationId"}}},"http":{}},"AssignPrivateIpAddresses":{"input":{"type":"structure","required":["NetworkInterfaceId"],"members":{"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"PrivateIpAddresses":{"shape":"Sg","locationName":"privateIpAddress"},"SecondaryPrivateIpAddressCount":{"locationName":"secondaryPrivateIpAddressCount","type":"integer"},"AllowReassignment":{"locationName":"allowReassignment","type":"boolean"}}},"http":{}},"AssociateAddress":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{},"PublicIp":{},"AllocationId":{},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"PrivateIpAddress":{"locationName":"privateIpAddress"},"AllowReassociation":{"locationName":"allowReassociation","type":"boolean"}}},"output":{"type":"structure","members":{"AssociationId":{"locationName":"associationId"}}},"http":{}},"AssociateDhcpOptions":{"input":{"type":"structure","required":["DhcpOptionsId","VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"DhcpOptionsId":{},"VpcId":{}}},"http":{}},"AssociateRouteTable":{"input":{"type":"structure","required":["SubnetId","RouteTableId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SubnetId":{"locationName":"subnetId"},"RouteTableId":{"locationName":"routeTableId"}}},"output":{"type":"structure","members":{"AssociationId":{"locationName":"associationId"}}},"http":{}},"AttachClassicLinkVpc":{"input":{"type":"structure","required":["InstanceId","VpcId","Groups"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{"locationName":"instanceId"},"VpcId":{"locationName":"vpcId"},"Groups":{"shape":"So","locationName":"SecurityGroupId"}}},"output":{"type":"structure","members":{"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"AttachInternetGateway":{"input":{"type":"structure","required":["InternetGatewayId","VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InternetGatewayId":{"locationName":"internetGatewayId"},"VpcId":{"locationName":"vpcId"}}},"http":{}},"AttachNetworkInterface":{"input":{"type":"structure","required":["NetworkInterfaceId","InstanceId","DeviceIndex"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"InstanceId":{"locationName":"instanceId"},"DeviceIndex":{"locationName":"deviceIndex","type":"integer"}}},"output":{"type":"structure","members":{"AttachmentId":{"locationName":"attachmentId"}}},"http":{}},"AttachVolume":{"input":{"type":"structure","required":["VolumeId","InstanceId","Device"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeId":{},"InstanceId":{},"Device":{}}},"output":{"shape":"Su","locationName":"attachment"},"http":{}},"AttachVpnGateway":{"input":{"type":"structure","required":["VpnGatewayId","VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpnGatewayId":{},"VpcId":{}}},"output":{"type":"structure","members":{"VpcAttachment":{"shape":"Sy","locationName":"attachment"}}},"http":{}},"AuthorizeSecurityGroupEgress":{"input":{"type":"structure","required":["GroupId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupId":{"locationName":"groupId"},"SourceSecurityGroupName":{"locationName":"sourceSecurityGroupName"},"SourceSecurityGroupOwnerId":{"locationName":"sourceSecurityGroupOwnerId"},"IpProtocol":{"locationName":"ipProtocol"},"FromPort":{"locationName":"fromPort","type":"integer"},"ToPort":{"locationName":"toPort","type":"integer"},"CidrIp":{"locationName":"cidrIp"},"IpPermissions":{"shape":"S11","locationName":"ipPermissions"}}},"http":{}},"AuthorizeSecurityGroupIngress":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupName":{},"GroupId":{},"SourceSecurityGroupName":{},"SourceSecurityGroupOwnerId":{},"IpProtocol":{},"FromPort":{"type":"integer"},"ToPort":{"type":"integer"},"CidrIp":{},"IpPermissions":{"shape":"S11"}}},"http":{}},"BundleInstance":{"input":{"type":"structure","required":["InstanceId","Storage"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{},"Storage":{"shape":"S1b"}}},"output":{"type":"structure","members":{"BundleTask":{"shape":"S1f","locationName":"bundleInstanceTask"}}},"http":{}},"CancelBundleTask":{"input":{"type":"structure","required":["BundleId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"BundleId":{}}},"output":{"type":"structure","members":{"BundleTask":{"shape":"S1f","locationName":"bundleInstanceTask"}}},"http":{}},"CancelConversionTask":{"input":{"type":"structure","required":["ConversionTaskId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ConversionTaskId":{"locationName":"conversionTaskId"},"ReasonMessage":{"locationName":"reasonMessage"}}},"http":{}},"CancelExportTask":{"input":{"type":"structure","required":["ExportTaskId"],"members":{"ExportTaskId":{"locationName":"exportTaskId"}}},"http":{}},"CancelImportTask":{"input":{"type":"structure","members":{"DryRun":{"type":"boolean"},"ImportTaskId":{},"CancelReason":{}}},"output":{"type":"structure","members":{"ImportTaskId":{"locationName":"importTaskId"},"State":{"locationName":"state"},"PreviousState":{"locationName":"previousState"}}},"http":{}},"CancelReservedInstancesListing":{"input":{"type":"structure","required":["ReservedInstancesListingId"],"members":{"ReservedInstancesListingId":{"locationName":"reservedInstancesListingId"}}},"output":{"type":"structure","members":{"ReservedInstancesListings":{"shape":"S1q","locationName":"reservedInstancesListingsSet"}}},"http":{}},"CancelSpotFleetRequests":{"input":{"type":"structure","required":["SpotFleetRequestIds","TerminateInstances"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SpotFleetRequestIds":{"shape":"S22","locationName":"spotFleetRequestId"},"TerminateInstances":{"locationName":"terminateInstances","type":"boolean"}}},"output":{"type":"structure","members":{"UnsuccessfulFleetRequests":{"locationName":"unsuccessfulFleetRequestSet","type":"list","member":{"locationName":"item","type":"structure","required":["SpotFleetRequestId","Error"],"members":{"SpotFleetRequestId":{"locationName":"spotFleetRequestId"},"Error":{"locationName":"error","type":"structure","required":["Code","Message"],"members":{"Code":{"locationName":"code"},"Message":{"locationName":"message"}}}}}},"SuccessfulFleetRequests":{"locationName":"successfulFleetRequestSet","type":"list","member":{"locationName":"item","type":"structure","required":["SpotFleetRequestId","CurrentSpotFleetRequestState","PreviousSpotFleetRequestState"],"members":{"SpotFleetRequestId":{"locationName":"spotFleetRequestId"},"CurrentSpotFleetRequestState":{"locationName":"currentSpotFleetRequestState"},"PreviousSpotFleetRequestState":{"locationName":"previousSpotFleetRequestState"}}}}}},"http":{}},"CancelSpotInstanceRequests":{"input":{"type":"structure","required":["SpotInstanceRequestIds"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SpotInstanceRequestIds":{"shape":"S2c","locationName":"SpotInstanceRequestId"}}},"output":{"type":"structure","members":{"CancelledSpotInstanceRequests":{"locationName":"spotInstanceRequestSet","type":"list","member":{"locationName":"item","type":"structure","members":{"SpotInstanceRequestId":{"locationName":"spotInstanceRequestId"},"State":{"locationName":"state"}}}}}},"http":{}},"ConfirmProductInstance":{"input":{"type":"structure","required":["ProductCode","InstanceId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ProductCode":{},"InstanceId":{}}},"output":{"type":"structure","members":{"OwnerId":{"locationName":"ownerId"},"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"CopyImage":{"input":{"type":"structure","required":["SourceRegion","SourceImageId","Name"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SourceRegion":{},"SourceImageId":{},"Name":{},"Description":{},"ClientToken":{}}},"output":{"type":"structure","members":{"ImageId":{"locationName":"imageId"}}},"http":{}},"CopySnapshot":{"input":{"type":"structure","required":["SourceRegion","SourceSnapshotId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SourceRegion":{},"SourceSnapshotId":{},"Description":{},"DestinationRegion":{"locationName":"destinationRegion"},"PresignedUrl":{"locationName":"presignedUrl"},"Encrypted":{"locationName":"encrypted","type":"boolean"},"KmsKeyId":{"locationName":"kmsKeyId"}}},"output":{"type":"structure","members":{"SnapshotId":{"locationName":"snapshotId"}}},"http":{}},"CreateCustomerGateway":{"input":{"type":"structure","required":["Type","PublicIp","BgpAsn"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Type":{},"PublicIp":{"locationName":"IpAddress"},"BgpAsn":{"type":"integer"}}},"output":{"type":"structure","members":{"CustomerGateway":{"shape":"S2q","locationName":"customerGateway"}}},"http":{}},"CreateDhcpOptions":{"input":{"type":"structure","required":["DhcpConfigurations"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"DhcpConfigurations":{"locationName":"dhcpConfiguration","type":"list","member":{"locationName":"item","type":"structure","members":{"Key":{"locationName":"key"},"Values":{"shape":"S22","locationName":"Value"}}}}}},"output":{"type":"structure","members":{"DhcpOptions":{"shape":"S2v","locationName":"dhcpOptions"}}},"http":{}},"CreateFlowLogs":{"input":{"type":"structure","required":["ResourceIds","ResourceType","TrafficType","LogGroupName","DeliverLogsPermissionArn"],"members":{"ResourceIds":{"shape":"S22","locationName":"ResourceId"},"ResourceType":{},"TrafficType":{},"LogGroupName":{},"DeliverLogsPermissionArn":{},"ClientToken":{}}},"output":{"type":"structure","members":{"FlowLogIds":{"shape":"S22","locationName":"flowLogIdSet"},"ClientToken":{"locationName":"clientToken"},"Unsuccessful":{"shape":"S34","locationName":"unsuccessful"}}},"http":{}},"CreateImage":{"input":{"type":"structure","required":["InstanceId","Name"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{"locationName":"instanceId"},"Name":{"locationName":"name"},"Description":{"locationName":"description"},"NoReboot":{"locationName":"noReboot","type":"boolean"},"BlockDeviceMappings":{"shape":"S38","locationName":"blockDeviceMapping"}}},"output":{"type":"structure","members":{"ImageId":{"locationName":"imageId"}}},"http":{}},"CreateInstanceExportTask":{"input":{"type":"structure","required":["InstanceId"],"members":{"Description":{"locationName":"description"},"InstanceId":{"locationName":"instanceId"},"TargetEnvironment":{"locationName":"targetEnvironment"},"ExportToS3Task":{"locationName":"exportToS3","type":"structure","members":{"DiskImageFormat":{"locationName":"diskImageFormat"},"ContainerFormat":{"locationName":"containerFormat"},"S3Bucket":{"locationName":"s3Bucket"},"S3Prefix":{"locationName":"s3Prefix"}}}}},"output":{"type":"structure","members":{"ExportTask":{"shape":"S3j","locationName":"exportTask"}}},"http":{}},"CreateInternetGateway":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"}}},"output":{"type":"structure","members":{"InternetGateway":{"shape":"S3p","locationName":"internetGateway"}}},"http":{}},"CreateKeyPair":{"input":{"type":"structure","required":["KeyName"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"KeyName":{}}},"output":{"locationName":"keyPair","type":"structure","members":{"KeyName":{"locationName":"keyName"},"KeyFingerprint":{"locationName":"keyFingerprint"},"KeyMaterial":{"locationName":"keyMaterial"}}},"http":{}},"CreateNetworkAcl":{"input":{"type":"structure","required":["VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcId":{"locationName":"vpcId"}}},"output":{"type":"structure","members":{"NetworkAcl":{"shape":"S3w","locationName":"networkAcl"}}},"http":{}},"CreateNetworkAclEntry":{"input":{"type":"structure","required":["NetworkAclId","RuleNumber","Protocol","RuleAction","Egress","CidrBlock"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkAclId":{"locationName":"networkAclId"},"RuleNumber":{"locationName":"ruleNumber","type":"integer"},"Protocol":{"locationName":"protocol"},"RuleAction":{"locationName":"ruleAction"},"Egress":{"locationName":"egress","type":"boolean"},"CidrBlock":{"locationName":"cidrBlock"},"IcmpTypeCode":{"shape":"S40","locationName":"Icmp"},"PortRange":{"shape":"S41","locationName":"portRange"}}},"http":{}},"CreateNetworkInterface":{"input":{"type":"structure","required":["SubnetId"],"members":{"SubnetId":{"locationName":"subnetId"},"Description":{"locationName":"description"},"PrivateIpAddress":{"locationName":"privateIpAddress"},"Groups":{"shape":"S46","locationName":"SecurityGroupId"},"PrivateIpAddresses":{"shape":"S47","locationName":"privateIpAddresses"},"SecondaryPrivateIpAddressCount":{"locationName":"secondaryPrivateIpAddressCount","type":"integer"},"DryRun":{"locationName":"dryRun","type":"boolean"}}},"output":{"type":"structure","members":{"NetworkInterface":{"shape":"S4a","locationName":"networkInterface"}}},"http":{}},"CreatePlacementGroup":{"input":{"type":"structure","required":["GroupName","Strategy"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupName":{"locationName":"groupName"},"Strategy":{"locationName":"strategy"}}},"http":{}},"CreateReservedInstancesListing":{"input":{"type":"structure","required":["ReservedInstancesId","InstanceCount","PriceSchedules","ClientToken"],"members":{"ReservedInstancesId":{"locationName":"reservedInstancesId"},"InstanceCount":{"locationName":"instanceCount","type":"integer"},"PriceSchedules":{"locationName":"priceSchedules","type":"list","member":{"locationName":"item","type":"structure","members":{"Term":{"locationName":"term","type":"long"},"Price":{"locationName":"price","type":"double"},"CurrencyCode":{"locationName":"currencyCode"}}}},"ClientToken":{"locationName":"clientToken"}}},"output":{"type":"structure","members":{"ReservedInstancesListings":{"shape":"S1q","locationName":"reservedInstancesListingsSet"}}},"http":{}},"CreateRoute":{"input":{"type":"structure","required":["RouteTableId","DestinationCidrBlock"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"RouteTableId":{"locationName":"routeTableId"},"DestinationCidrBlock":{"locationName":"destinationCidrBlock"},"GatewayId":{"locationName":"gatewayId"},"InstanceId":{"locationName":"instanceId"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"VpcPeeringConnectionId":{"locationName":"vpcPeeringConnectionId"}}},"output":{"type":"structure","members":{"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"CreateRouteTable":{"input":{"type":"structure","required":["VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcId":{"locationName":"vpcId"}}},"output":{"type":"structure","members":{"RouteTable":{"shape":"S4s","locationName":"routeTable"}}},"http":{}},"CreateSecurityGroup":{"input":{"type":"structure","required":["GroupName","Description"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupName":{},"Description":{"locationName":"GroupDescription"},"VpcId":{}}},"output":{"type":"structure","members":{"GroupId":{"locationName":"groupId"}}},"http":{}},"CreateSnapshot":{"input":{"type":"structure","required":["VolumeId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeId":{},"Description":{}}},"output":{"shape":"S54","locationName":"snapshot"},"http":{}},"CreateSpotDatafeedSubscription":{"input":{"type":"structure","required":["Bucket"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Bucket":{"locationName":"bucket"},"Prefix":{"locationName":"prefix"}}},"output":{"type":"structure","members":{"SpotDatafeedSubscription":{"shape":"S58","locationName":"spotDatafeedSubscription"}}},"http":{}},"CreateSubnet":{"input":{"type":"structure","required":["VpcId","CidrBlock"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcId":{},"CidrBlock":{},"AvailabilityZone":{}}},"output":{"type":"structure","members":{"Subnet":{"shape":"S5d","locationName":"subnet"}}},"http":{}},"CreateTags":{"input":{"type":"structure","required":["Resources","Tags"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Resources":{"shape":"S5g","locationName":"ResourceId"},"Tags":{"shape":"Sa","locationName":"Tag"}}},"http":{}},"CreateVolume":{"input":{"type":"structure","required":["AvailabilityZone"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Size":{"type":"integer"},"SnapshotId":{},"AvailabilityZone":{},"VolumeType":{},"Iops":{"type":"integer"},"Encrypted":{"locationName":"encrypted","type":"boolean"},"KmsKeyId":{}}},"output":{"shape":"S5i","locationName":"volume"},"http":{}},"CreateVpc":{"input":{"type":"structure","required":["CidrBlock"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"CidrBlock":{},"InstanceTenancy":{"locationName":"instanceTenancy"}}},"output":{"type":"structure","members":{"Vpc":{"shape":"S5o","locationName":"vpc"}}},"http":{}},"CreateVpcEndpoint":{"input":{"type":"structure","required":["VpcId","ServiceName"],"members":{"DryRun":{"type":"boolean"},"VpcId":{},"ServiceName":{},"PolicyDocument":{},"RouteTableIds":{"shape":"S22","locationName":"RouteTableId"},"ClientToken":{}}},"output":{"type":"structure","members":{"VpcEndpoint":{"shape":"S5s","locationName":"vpcEndpoint"},"ClientToken":{"locationName":"clientToken"}}},"http":{}},"CreateVpcPeeringConnection":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcId":{"locationName":"vpcId"},"PeerVpcId":{"locationName":"peerVpcId"},"PeerOwnerId":{"locationName":"peerOwnerId"}}},"output":{"type":"structure","members":{"VpcPeeringConnection":{"shape":"S5","locationName":"vpcPeeringConnection"}}},"http":{}},"CreateVpnConnection":{"input":{"type":"structure","required":["Type","CustomerGatewayId","VpnGatewayId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Type":{},"CustomerGatewayId":{},"VpnGatewayId":{},"Options":{"locationName":"options","type":"structure","members":{"StaticRoutesOnly":{"locationName":"staticRoutesOnly","type":"boolean"}}}}},"output":{"type":"structure","members":{"VpnConnection":{"shape":"S5z","locationName":"vpnConnection"}}},"http":{}},"CreateVpnConnectionRoute":{"input":{"type":"structure","required":["VpnConnectionId","DestinationCidrBlock"],"members":{"VpnConnectionId":{},"DestinationCidrBlock":{}}},"http":{}},"CreateVpnGateway":{"input":{"type":"structure","required":["Type"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Type":{},"AvailabilityZone":{}}},"output":{"type":"structure","members":{"VpnGateway":{"shape":"S6b","locationName":"vpnGateway"}}},"http":{}},"DeleteCustomerGateway":{"input":{"type":"structure","required":["CustomerGatewayId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"CustomerGatewayId":{}}},"http":{}},"DeleteDhcpOptions":{"input":{"type":"structure","required":["DhcpOptionsId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"DhcpOptionsId":{}}},"http":{}},"DeleteFlowLogs":{"input":{"type":"structure","required":["FlowLogIds"],"members":{"FlowLogIds":{"shape":"S22","locationName":"FlowLogId"}}},"output":{"type":"structure","members":{"Unsuccessful":{"shape":"S34","locationName":"unsuccessful"}}},"http":{}},"DeleteInternetGateway":{"input":{"type":"structure","required":["InternetGatewayId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InternetGatewayId":{"locationName":"internetGatewayId"}}},"http":{}},"DeleteKeyPair":{"input":{"type":"structure","required":["KeyName"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"KeyName":{}}},"http":{}},"DeleteNetworkAcl":{"input":{"type":"structure","required":["NetworkAclId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkAclId":{"locationName":"networkAclId"}}},"http":{}},"DeleteNetworkAclEntry":{"input":{"type":"structure","required":["NetworkAclId","RuleNumber","Egress"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkAclId":{"locationName":"networkAclId"},"RuleNumber":{"locationName":"ruleNumber","type":"integer"},"Egress":{"locationName":"egress","type":"boolean"}}},"http":{}},"DeleteNetworkInterface":{"input":{"type":"structure","required":["NetworkInterfaceId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"}}},"http":{}},"DeletePlacementGroup":{"input":{"type":"structure","required":["GroupName"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupName":{"locationName":"groupName"}}},"http":{}},"DeleteRoute":{"input":{"type":"structure","required":["RouteTableId","DestinationCidrBlock"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"RouteTableId":{"locationName":"routeTableId"},"DestinationCidrBlock":{"locationName":"destinationCidrBlock"}}},"http":{}},"DeleteRouteTable":{"input":{"type":"structure","required":["RouteTableId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"RouteTableId":{"locationName":"routeTableId"}}},"http":{}},"DeleteSecurityGroup":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupName":{},"GroupId":{}}},"http":{}},"DeleteSnapshot":{"input":{"type":"structure","required":["SnapshotId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SnapshotId":{}}},"http":{}},"DeleteSpotDatafeedSubscription":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"}}},"http":{}},"DeleteSubnet":{"input":{"type":"structure","required":["SubnetId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SubnetId":{}}},"http":{}},"DeleteTags":{"input":{"type":"structure","required":["Resources"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Resources":{"shape":"S5g","locationName":"resourceId"},"Tags":{"shape":"Sa","locationName":"tag"}}},"http":{}},"DeleteVolume":{"input":{"type":"structure","required":["VolumeId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeId":{}}},"http":{}},"DeleteVpc":{"input":{"type":"structure","required":["VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcId":{}}},"http":{}},"DeleteVpcEndpoints":{"input":{"type":"structure","required":["VpcEndpointIds"],"members":{"DryRun":{"type":"boolean"},"VpcEndpointIds":{"shape":"S22","locationName":"VpcEndpointId"}}},"output":{"type":"structure","members":{"Unsuccessful":{"shape":"S34","locationName":"unsuccessful"}}},"http":{}},"DeleteVpcPeeringConnection":{"input":{"type":"structure","required":["VpcPeeringConnectionId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcPeeringConnectionId":{"locationName":"vpcPeeringConnectionId"}}},"output":{"type":"structure","members":{"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"DeleteVpnConnection":{"input":{"type":"structure","required":["VpnConnectionId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpnConnectionId":{}}},"http":{}},"DeleteVpnConnectionRoute":{"input":{"type":"structure","required":["VpnConnectionId","DestinationCidrBlock"],"members":{"VpnConnectionId":{},"DestinationCidrBlock":{}}},"http":{}},"DeleteVpnGateway":{"input":{"type":"structure","required":["VpnGatewayId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpnGatewayId":{}}},"http":{}},"DeregisterImage":{"input":{"type":"structure","required":["ImageId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ImageId":{}}},"http":{}},"DescribeAccountAttributes":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"AttributeNames":{"locationName":"attributeName","type":"list","member":{"locationName":"attributeName"}}}},"output":{"type":"structure","members":{"AccountAttributes":{"locationName":"accountAttributeSet","type":"list","member":{"locationName":"item","type":"structure","members":{"AttributeName":{"locationName":"attributeName"},"AttributeValues":{"locationName":"attributeValueSet","type":"list","member":{"locationName":"item","type":"structure","members":{"AttributeValue":{"locationName":"attributeValue"}}}}}}}}},"http":{}},"DescribeAddresses":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"PublicIps":{"locationName":"PublicIp","type":"list","member":{"locationName":"PublicIp"}},"Filters":{"shape":"S7e","locationName":"Filter"},"AllocationIds":{"locationName":"AllocationId","type":"list","member":{"locationName":"AllocationId"}}}},"output":{"type":"structure","members":{"Addresses":{"locationName":"addressesSet","type":"list","member":{"locationName":"item","type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"PublicIp":{"locationName":"publicIp"},"AllocationId":{"locationName":"allocationId"},"AssociationId":{"locationName":"associationId"},"Domain":{"locationName":"domain"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"NetworkInterfaceOwnerId":{"locationName":"networkInterfaceOwnerId"},"PrivateIpAddress":{"locationName":"privateIpAddress"}}}}}},"http":{}},"DescribeAvailabilityZones":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ZoneNames":{"locationName":"ZoneName","type":"list","member":{"locationName":"ZoneName"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"AvailabilityZones":{"locationName":"availabilityZoneInfo","type":"list","member":{"locationName":"item","type":"structure","members":{"ZoneName":{"locationName":"zoneName"},"State":{"locationName":"zoneState"},"RegionName":{"locationName":"regionName"},"Messages":{"locationName":"messageSet","type":"list","member":{"locationName":"item","type":"structure","members":{"Message":{"locationName":"message"}}}}}}}}},"http":{}},"DescribeBundleTasks":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"BundleIds":{"locationName":"BundleId","type":"list","member":{"locationName":"BundleId"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"BundleTasks":{"locationName":"bundleInstanceTasksSet","type":"list","member":{"shape":"S1f","locationName":"item"}}}},"http":{}},"DescribeClassicLinkInstances":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceIds":{"shape":"S7x","locationName":"InstanceId"},"Filters":{"shape":"S7e","locationName":"Filter"},"NextToken":{"locationName":"nextToken"},"MaxResults":{"locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","members":{"Instances":{"locationName":"instancesSet","type":"list","member":{"locationName":"item","type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"VpcId":{"locationName":"vpcId"},"Groups":{"shape":"S4c","locationName":"groupSet"},"Tags":{"shape":"Sa","locationName":"tagSet"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeConversionTasks":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Filters":{"shape":"S7e","locationName":"filter"},"ConversionTaskIds":{"locationName":"conversionTaskId","type":"list","member":{"locationName":"item"}}}},"output":{"type":"structure","members":{"ConversionTasks":{"locationName":"conversionTasks","type":"list","member":{"shape":"S85","locationName":"item"}}}},"http":{}},"DescribeCustomerGateways":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"CustomerGatewayIds":{"locationName":"CustomerGatewayId","type":"list","member":{"locationName":"CustomerGatewayId"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"CustomerGateways":{"locationName":"customerGatewaySet","type":"list","member":{"shape":"S2q","locationName":"item"}}}},"http":{}},"DescribeDhcpOptions":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"DhcpOptionsIds":{"locationName":"DhcpOptionsId","type":"list","member":{"locationName":"DhcpOptionsId"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"DhcpOptions":{"locationName":"dhcpOptionsSet","type":"list","member":{"shape":"S2v","locationName":"item"}}}},"http":{}},"DescribeExportTasks":{"input":{"type":"structure","members":{"ExportTaskIds":{"locationName":"exportTaskId","type":"list","member":{"locationName":"ExportTaskId"}}}},"output":{"type":"structure","members":{"ExportTasks":{"locationName":"exportTaskSet","type":"list","member":{"shape":"S3j","locationName":"item"}}}},"http":{}},"DescribeFlowLogs":{"input":{"type":"structure","members":{"FlowLogIds":{"shape":"S22","locationName":"FlowLogId"},"Filter":{"shape":"S7e"},"NextToken":{},"MaxResults":{"type":"integer"}}},"output":{"type":"structure","members":{"FlowLogs":{"locationName":"flowLogSet","type":"list","member":{"locationName":"item","type":"structure","members":{"CreationTime":{"locationName":"creationTime","type":"timestamp"},"FlowLogId":{"locationName":"flowLogId"},"FlowLogStatus":{"locationName":"flowLogStatus"},"ResourceId":{"locationName":"resourceId"},"TrafficType":{"locationName":"trafficType"},"LogGroupName":{"locationName":"logGroupName"},"DeliverLogsStatus":{"locationName":"deliverLogsStatus"},"DeliverLogsErrorMessage":{"locationName":"deliverLogsErrorMessage"},"DeliverLogsPermissionArn":{"locationName":"deliverLogsPermissionArn"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeImageAttribute":{"input":{"type":"structure","required":["ImageId","Attribute"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ImageId":{},"Attribute":{}}},"output":{"locationName":"imageAttribute","type":"structure","members":{"ImageId":{"locationName":"imageId"},"LaunchPermissions":{"shape":"S8x","locationName":"launchPermission"},"ProductCodes":{"shape":"S90","locationName":"productCodes"},"KernelId":{"shape":"S2z","locationName":"kernel"},"RamdiskId":{"shape":"S2z","locationName":"ramdisk"},"Description":{"shape":"S2z","locationName":"description"},"SriovNetSupport":{"shape":"S2z","locationName":"sriovNetSupport"},"BlockDeviceMappings":{"shape":"S93","locationName":"blockDeviceMapping"}}},"http":{}},"DescribeImages":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ImageIds":{"locationName":"ImageId","type":"list","member":{"locationName":"ImageId"}},"Owners":{"shape":"S96","locationName":"Owner"},"ExecutableUsers":{"locationName":"ExecutableBy","type":"list","member":{"locationName":"ExecutableBy"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"Images":{"locationName":"imagesSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ImageId":{"locationName":"imageId"},"ImageLocation":{"locationName":"imageLocation"},"State":{"locationName":"imageState"},"OwnerId":{"locationName":"imageOwnerId"},"CreationDate":{"locationName":"creationDate"},"Public":{"locationName":"isPublic","type":"boolean"},"ProductCodes":{"shape":"S90","locationName":"productCodes"},"Architecture":{"locationName":"architecture"},"ImageType":{"locationName":"imageType"},"KernelId":{"locationName":"kernelId"},"RamdiskId":{"locationName":"ramdiskId"},"Platform":{"locationName":"platform"},"SriovNetSupport":{"locationName":"sriovNetSupport"},"StateReason":{"shape":"S9e","locationName":"stateReason"},"ImageOwnerAlias":{"locationName":"imageOwnerAlias"},"Name":{"locationName":"name"},"Description":{"locationName":"description"},"RootDeviceType":{"locationName":"rootDeviceType"},"RootDeviceName":{"locationName":"rootDeviceName"},"BlockDeviceMappings":{"shape":"S93","locationName":"blockDeviceMapping"},"VirtualizationType":{"locationName":"virtualizationType"},"Tags":{"shape":"Sa","locationName":"tagSet"},"Hypervisor":{"locationName":"hypervisor"}}}}}},"http":{}},"DescribeImportImageTasks":{"input":{"type":"structure","members":{"DryRun":{"type":"boolean"},"ImportTaskIds":{"shape":"S9j","locationName":"ImportTaskId"},"NextToken":{},"MaxResults":{"type":"integer"},"Filters":{"shape":"S7e"}}},"output":{"type":"structure","members":{"ImportImageTasks":{"locationName":"importImageTaskSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ImportTaskId":{"locationName":"importTaskId"},"Architecture":{"locationName":"architecture"},"LicenseType":{"locationName":"licenseType"},"Platform":{"locationName":"platform"},"Hypervisor":{"locationName":"hypervisor"},"Description":{"locationName":"description"},"SnapshotDetails":{"shape":"S9n","locationName":"snapshotDetailSet"},"ImageId":{"locationName":"imageId"},"Progress":{"locationName":"progress"},"StatusMessage":{"locationName":"statusMessage"},"Status":{"locationName":"status"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeImportSnapshotTasks":{"input":{"type":"structure","members":{"DryRun":{"type":"boolean"},"ImportTaskIds":{"shape":"S9j","locationName":"ImportTaskId"},"NextToken":{},"MaxResults":{"type":"integer"},"Filters":{"shape":"S7e"}}},"output":{"type":"structure","members":{"ImportSnapshotTasks":{"locationName":"importSnapshotTaskSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ImportTaskId":{"locationName":"importTaskId"},"SnapshotTaskDetail":{"shape":"S9u","locationName":"snapshotTaskDetail"},"Description":{"locationName":"description"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeInstanceAttribute":{"input":{"type":"structure","required":["InstanceId","Attribute"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{"locationName":"instanceId"},"Attribute":{"locationName":"attribute"}}},"output":{"type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"InstanceType":{"shape":"S2z","locationName":"instanceType"},"KernelId":{"shape":"S2z","locationName":"kernel"},"RamdiskId":{"shape":"S2z","locationName":"ramdisk"},"UserData":{"shape":"S2z","locationName":"userData"},"DisableApiTermination":{"shape":"S9y","locationName":"disableApiTermination"},"InstanceInitiatedShutdownBehavior":{"shape":"S2z","locationName":"instanceInitiatedShutdownBehavior"},"RootDeviceName":{"shape":"S2z","locationName":"rootDeviceName"},"BlockDeviceMappings":{"shape":"S9z","locationName":"blockDeviceMapping"},"ProductCodes":{"shape":"S90","locationName":"productCodes"},"EbsOptimized":{"shape":"S9y","locationName":"ebsOptimized"},"SriovNetSupport":{"shape":"S2z","locationName":"sriovNetSupport"},"SourceDestCheck":{"shape":"S9y","locationName":"sourceDestCheck"},"Groups":{"shape":"S4c","locationName":"groupSet"}}},"http":{}},"DescribeInstanceStatus":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceIds":{"shape":"S7x","locationName":"InstanceId"},"Filters":{"shape":"S7e","locationName":"Filter"},"NextToken":{},"MaxResults":{"type":"integer"},"IncludeAllInstances":{"locationName":"includeAllInstances","type":"boolean"}}},"output":{"type":"structure","members":{"InstanceStatuses":{"locationName":"instanceStatusSet","type":"list","member":{"locationName":"item","type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"AvailabilityZone":{"locationName":"availabilityZone"},"Events":{"locationName":"eventsSet","type":"list","member":{"locationName":"item","type":"structure","members":{"Code":{"locationName":"code"},"Description":{"locationName":"description"},"NotBefore":{"locationName":"notBefore","type":"timestamp"},"NotAfter":{"locationName":"notAfter","type":"timestamp"}}}},"InstanceState":{"shape":"Sa9","locationName":"instanceState"},"SystemStatus":{"shape":"Sab","locationName":"systemStatus"},"InstanceStatus":{"shape":"Sab","locationName":"instanceStatus"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeInstances":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceIds":{"shape":"S7x","locationName":"InstanceId"},"Filters":{"shape":"S7e","locationName":"Filter"},"NextToken":{"locationName":"nextToken"},"MaxResults":{"locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","members":{"Reservations":{"locationName":"reservationSet","type":"list","member":{"shape":"Sak","locationName":"item"}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeInternetGateways":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InternetGatewayIds":{"shape":"S22","locationName":"internetGatewayId"},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"InternetGateways":{"locationName":"internetGatewaySet","type":"list","member":{"shape":"S3p","locationName":"item"}}}},"http":{}},"DescribeKeyPairs":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"KeyNames":{"locationName":"KeyName","type":"list","member":{"locationName":"KeyName"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"KeyPairs":{"locationName":"keySet","type":"list","member":{"locationName":"item","type":"structure","members":{"KeyName":{"locationName":"keyName"},"KeyFingerprint":{"locationName":"keyFingerprint"}}}}}},"http":{}},"DescribeMovingAddresses":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"PublicIps":{"shape":"S22","locationName":"publicIp"},"NextToken":{"locationName":"nextToken"},"Filters":{"shape":"S7e","locationName":"filter"},"MaxResults":{"locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","members":{"MovingAddressStatuses":{"locationName":"movingAddressStatusSet","type":"list","member":{"locationName":"item","type":"structure","members":{"PublicIp":{"locationName":"publicIp"},"MoveStatus":{"locationName":"moveStatus"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeNetworkAcls":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkAclIds":{"shape":"S22","locationName":"NetworkAclId"},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"NetworkAcls":{"locationName":"networkAclSet","type":"list","member":{"shape":"S3w","locationName":"item"}}}},"http":{}},"DescribeNetworkInterfaceAttribute":{"input":{"type":"structure","required":["NetworkInterfaceId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"Attribute":{"locationName":"attribute"}}},"output":{"type":"structure","members":{"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"Description":{"shape":"S2z","locationName":"description"},"SourceDestCheck":{"shape":"S9y","locationName":"sourceDestCheck"},"Groups":{"shape":"S4c","locationName":"groupSet"},"Attachment":{"shape":"S4e","locationName":"attachment"}}},"http":{}},"DescribeNetworkInterfaces":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkInterfaceIds":{"locationName":"NetworkInterfaceId","type":"list","member":{"locationName":"item"}},"Filters":{"shape":"S7e","locationName":"filter"}}},"output":{"type":"structure","members":{"NetworkInterfaces":{"locationName":"networkInterfaceSet","type":"list","member":{"shape":"S4a","locationName":"item"}}}},"http":{}},"DescribePlacementGroups":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupNames":{"locationName":"groupName","type":"list","member":{}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"PlacementGroups":{"locationName":"placementGroupSet","type":"list","member":{"locationName":"item","type":"structure","members":{"GroupName":{"locationName":"groupName"},"Strategy":{"locationName":"strategy"},"State":{"locationName":"state"}}}}}},"http":{}},"DescribePrefixLists":{"input":{"type":"structure","members":{"DryRun":{"type":"boolean"},"PrefixListIds":{"shape":"S22","locationName":"PrefixListId"},"Filters":{"shape":"S7e","locationName":"Filter"},"MaxResults":{"type":"integer"},"NextToken":{}}},"output":{"type":"structure","members":{"PrefixLists":{"locationName":"prefixListSet","type":"list","member":{"locationName":"item","type":"structure","members":{"PrefixListId":{"locationName":"prefixListId"},"PrefixListName":{"locationName":"prefixListName"},"Cidrs":{"shape":"S22","locationName":"cidrSet"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeRegions":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"RegionNames":{"locationName":"RegionName","type":"list","member":{"locationName":"RegionName"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"Regions":{"locationName":"regionInfo","type":"list","member":{"locationName":"item","type":"structure","members":{"RegionName":{"locationName":"regionName"},"Endpoint":{"locationName":"regionEndpoint"}}}}}},"http":{}},"DescribeReservedInstances":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ReservedInstancesIds":{"shape":"Sc2","locationName":"ReservedInstancesId"},"Filters":{"shape":"S7e","locationName":"Filter"},"OfferingType":{"locationName":"offeringType"}}},"output":{"type":"structure","members":{"ReservedInstances":{"locationName":"reservedInstancesSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ReservedInstancesId":{"locationName":"reservedInstancesId"},"InstanceType":{"locationName":"instanceType"},"AvailabilityZone":{"locationName":"availabilityZone"},"Start":{"locationName":"start","type":"timestamp"},"End":{"locationName":"end","type":"timestamp"},"Duration":{"locationName":"duration","type":"long"},"UsagePrice":{"locationName":"usagePrice","type":"float"},"FixedPrice":{"locationName":"fixedPrice","type":"float"},"InstanceCount":{"locationName":"instanceCount","type":"integer"},"ProductDescription":{"locationName":"productDescription"},"State":{"locationName":"state"},"Tags":{"shape":"Sa","locationName":"tagSet"},"InstanceTenancy":{"locationName":"instanceTenancy"},"CurrencyCode":{"locationName":"currencyCode"},"OfferingType":{"locationName":"offeringType"},"RecurringCharges":{"shape":"Sca","locationName":"recurringCharges"}}}}}},"http":{}},"DescribeReservedInstancesListings":{"input":{"type":"structure","members":{"ReservedInstancesId":{"locationName":"reservedInstancesId"},"ReservedInstancesListingId":{"locationName":"reservedInstancesListingId"},"Filters":{"shape":"S7e","locationName":"filters"}}},"output":{"type":"structure","members":{"ReservedInstancesListings":{"shape":"S1q","locationName":"reservedInstancesListingsSet"}}},"http":{}},"DescribeReservedInstancesModifications":{"input":{"type":"structure","members":{"ReservedInstancesModificationIds":{"locationName":"ReservedInstancesModificationId","type":"list","member":{"locationName":"ReservedInstancesModificationId"}},"NextToken":{"locationName":"nextToken"},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"ReservedInstancesModifications":{"locationName":"reservedInstancesModificationsSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ReservedInstancesModificationId":{"locationName":"reservedInstancesModificationId"},"ReservedInstancesIds":{"locationName":"reservedInstancesSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ReservedInstancesId":{"locationName":"reservedInstancesId"}}}},"ModificationResults":{"locationName":"modificationResultSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ReservedInstancesId":{"locationName":"reservedInstancesId"},"TargetConfiguration":{"shape":"Sco","locationName":"targetConfiguration"}}}},"CreateDate":{"locationName":"createDate","type":"timestamp"},"UpdateDate":{"locationName":"updateDate","type":"timestamp"},"EffectiveDate":{"locationName":"effectiveDate","type":"timestamp"},"Status":{"locationName":"status"},"StatusMessage":{"locationName":"statusMessage"},"ClientToken":{"locationName":"clientToken"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeReservedInstancesOfferings":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ReservedInstancesOfferingIds":{"locationName":"ReservedInstancesOfferingId","type":"list","member":{}},"InstanceType":{},"AvailabilityZone":{},"ProductDescription":{},"Filters":{"shape":"S7e","locationName":"Filter"},"InstanceTenancy":{"locationName":"instanceTenancy"},"OfferingType":{"locationName":"offeringType"},"NextToken":{"locationName":"nextToken"},"MaxResults":{"locationName":"maxResults","type":"integer"},"IncludeMarketplace":{"type":"boolean"},"MinDuration":{"type":"long"},"MaxDuration":{"type":"long"},"MaxInstanceCount":{"type":"integer"}}},"output":{"type":"structure","members":{"ReservedInstancesOfferings":{"locationName":"reservedInstancesOfferingsSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ReservedInstancesOfferingId":{"locationName":"reservedInstancesOfferingId"},"InstanceType":{"locationName":"instanceType"},"AvailabilityZone":{"locationName":"availabilityZone"},"Duration":{"locationName":"duration","type":"long"},"UsagePrice":{"locationName":"usagePrice","type":"float"},"FixedPrice":{"locationName":"fixedPrice","type":"float"},"ProductDescription":{"locationName":"productDescription"},"InstanceTenancy":{"locationName":"instanceTenancy"},"CurrencyCode":{"locationName":"currencyCode"},"OfferingType":{"locationName":"offeringType"},"RecurringCharges":{"shape":"Sca","locationName":"recurringCharges"},"Marketplace":{"locationName":"marketplace","type":"boolean"},"PricingDetails":{"locationName":"pricingDetailsSet","type":"list","member":{"locationName":"item","type":"structure","members":{"Price":{"locationName":"price","type":"double"},"Count":{"locationName":"count","type":"integer"}}}}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeRouteTables":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"RouteTableIds":{"shape":"S22","locationName":"RouteTableId"},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"RouteTables":{"locationName":"routeTableSet","type":"list","member":{"shape":"S4s","locationName":"item"}}}},"http":{}},"DescribeSecurityGroups":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupNames":{"shape":"Sd0","locationName":"GroupName"},"GroupIds":{"shape":"So","locationName":"GroupId"},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"SecurityGroups":{"locationName":"securityGroupInfo","type":"list","member":{"locationName":"item","type":"structure","members":{"OwnerId":{"locationName":"ownerId"},"GroupName":{"locationName":"groupName"},"GroupId":{"locationName":"groupId"},"Description":{"locationName":"groupDescription"},"IpPermissions":{"shape":"S11","locationName":"ipPermissions"},"IpPermissionsEgress":{"shape":"S11","locationName":"ipPermissionsEgress"},"VpcId":{"locationName":"vpcId"},"Tags":{"shape":"Sa","locationName":"tagSet"}}}}}},"http":{}},"DescribeSnapshotAttribute":{"input":{"type":"structure","required":["SnapshotId","Attribute"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SnapshotId":{},"Attribute":{}}},"output":{"type":"structure","members":{"SnapshotId":{"locationName":"snapshotId"},"CreateVolumePermissions":{"shape":"Sd7","locationName":"createVolumePermission"},"ProductCodes":{"shape":"S90","locationName":"productCodes"}}},"http":{}},"DescribeSnapshots":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SnapshotIds":{"locationName":"SnapshotId","type":"list","member":{"locationName":"SnapshotId"}},"OwnerIds":{"shape":"S96","locationName":"Owner"},"RestorableByUserIds":{"locationName":"RestorableBy","type":"list","member":{}},"Filters":{"shape":"S7e","locationName":"Filter"},"NextToken":{},"MaxResults":{"type":"integer"}}},"output":{"type":"structure","members":{"Snapshots":{"locationName":"snapshotSet","type":"list","member":{"shape":"S54","locationName":"item"}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeSpotDatafeedSubscription":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"}}},"output":{"type":"structure","members":{"SpotDatafeedSubscription":{"shape":"S58","locationName":"spotDatafeedSubscription"}}},"http":{}},"DescribeSpotFleetInstances":{"input":{"type":"structure","required":["SpotFleetRequestId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SpotFleetRequestId":{"locationName":"spotFleetRequestId"},"NextToken":{"locationName":"nextToken"},"MaxResults":{"locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","required":["SpotFleetRequestId","ActiveInstances"],"members":{"SpotFleetRequestId":{"locationName":"spotFleetRequestId"},"ActiveInstances":{"locationName":"activeInstanceSet","type":"list","member":{"locationName":"item","type":"structure","members":{"InstanceType":{"locationName":"instanceType"},"InstanceId":{"locationName":"instanceId"},"SpotInstanceRequestId":{"locationName":"spotInstanceRequestId"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeSpotFleetRequestHistory":{"input":{"type":"structure","required":["SpotFleetRequestId","StartTime"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SpotFleetRequestId":{"locationName":"spotFleetRequestId"},"EventType":{"locationName":"eventType"},"StartTime":{"locationName":"startTime","type":"timestamp"},"NextToken":{"locationName":"nextToken"},"MaxResults":{"locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","required":["SpotFleetRequestId","StartTime","LastEvaluatedTime","HistoryRecords"],"members":{"SpotFleetRequestId":{"locationName":"spotFleetRequestId"},"StartTime":{"locationName":"startTime","type":"timestamp"},"LastEvaluatedTime":{"locationName":"lastEvaluatedTime","type":"timestamp"},"HistoryRecords":{"locationName":"historyRecordSet","type":"list","member":{"locationName":"item","type":"structure","required":["Timestamp","EventType","EventInformation"],"members":{"Timestamp":{"locationName":"timestamp","type":"timestamp"},"EventType":{"locationName":"eventType"},"EventInformation":{"locationName":"eventInformation","type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"EventSubType":{"locationName":"eventSubType"},"EventDescription":{"locationName":"eventDescription"}}}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeSpotFleetRequests":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SpotFleetRequestIds":{"shape":"S22","locationName":"spotFleetRequestId"},"NextToken":{"locationName":"nextToken"},"MaxResults":{"locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","required":["SpotFleetRequestConfigs"],"members":{"SpotFleetRequestConfigs":{"locationName":"spotFleetRequestConfigSet","type":"list","member":{"locationName":"item","type":"structure","required":["SpotFleetRequestId","SpotFleetRequestState","SpotFleetRequestConfig"],"members":{"SpotFleetRequestId":{"locationName":"spotFleetRequestId"},"SpotFleetRequestState":{"locationName":"spotFleetRequestState"},"SpotFleetRequestConfig":{"shape":"Sdu","locationName":"spotFleetRequestConfig"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeSpotInstanceRequests":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SpotInstanceRequestIds":{"shape":"S2c","locationName":"SpotInstanceRequestId"},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"SpotInstanceRequests":{"shape":"Se4","locationName":"spotInstanceRequestSet"}}},"http":{}},"DescribeSpotPriceHistory":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"StartTime":{"locationName":"startTime","type":"timestamp"},"EndTime":{"locationName":"endTime","type":"timestamp"},"InstanceTypes":{"locationName":"InstanceType","type":"list","member":{}},"ProductDescriptions":{"locationName":"ProductDescription","type":"list","member":{}},"Filters":{"shape":"S7e","locationName":"Filter"},"AvailabilityZone":{"locationName":"availabilityZone"},"MaxResults":{"locationName":"maxResults","type":"integer"},"NextToken":{"locationName":"nextToken"}}},"output":{"type":"structure","members":{"SpotPriceHistory":{"locationName":"spotPriceHistorySet","type":"list","member":{"locationName":"item","type":"structure","members":{"InstanceType":{"locationName":"instanceType"},"ProductDescription":{"locationName":"productDescription"},"SpotPrice":{"locationName":"spotPrice"},"Timestamp":{"locationName":"timestamp","type":"timestamp"},"AvailabilityZone":{"locationName":"availabilityZone"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeSubnets":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SubnetIds":{"locationName":"SubnetId","type":"list","member":{"locationName":"SubnetId"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"Subnets":{"locationName":"subnetSet","type":"list","member":{"shape":"S5d","locationName":"item"}}}},"http":{}},"DescribeTags":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Filters":{"shape":"S7e","locationName":"Filter"},"MaxResults":{"locationName":"maxResults","type":"integer"},"NextToken":{"locationName":"nextToken"}}},"output":{"type":"structure","members":{"Tags":{"locationName":"tagSet","type":"list","member":{"locationName":"item","type":"structure","members":{"ResourceId":{"locationName":"resourceId"},"ResourceType":{"locationName":"resourceType"},"Key":{"locationName":"key"},"Value":{"locationName":"value"}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeVolumeAttribute":{"input":{"type":"structure","required":["VolumeId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeId":{},"Attribute":{}}},"output":{"type":"structure","members":{"VolumeId":{"locationName":"volumeId"},"AutoEnableIO":{"shape":"S9y","locationName":"autoEnableIO"},"ProductCodes":{"shape":"S90","locationName":"productCodes"}}},"http":{}},"DescribeVolumeStatus":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeIds":{"shape":"Seu","locationName":"VolumeId"},"Filters":{"shape":"S7e","locationName":"Filter"},"NextToken":{},"MaxResults":{"type":"integer"}}},"output":{"type":"structure","members":{"VolumeStatuses":{"locationName":"volumeStatusSet","type":"list","member":{"locationName":"item","type":"structure","members":{"VolumeId":{"locationName":"volumeId"},"AvailabilityZone":{"locationName":"availabilityZone"},"VolumeStatus":{"locationName":"volumeStatus","type":"structure","members":{"Status":{"locationName":"status"},"Details":{"locationName":"details","type":"list","member":{"locationName":"item","type":"structure","members":{"Name":{"locationName":"name"},"Status":{"locationName":"status"}}}}}},"Events":{"locationName":"eventsSet","type":"list","member":{"locationName":"item","type":"structure","members":{"EventType":{"locationName":"eventType"},"Description":{"locationName":"description"},"NotBefore":{"locationName":"notBefore","type":"timestamp"},"NotAfter":{"locationName":"notAfter","type":"timestamp"},"EventId":{"locationName":"eventId"}}}},"Actions":{"locationName":"actionsSet","type":"list","member":{"locationName":"item","type":"structure","members":{"Code":{"locationName":"code"},"Description":{"locationName":"description"},"EventType":{"locationName":"eventType"},"EventId":{"locationName":"eventId"}}}}}}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeVolumes":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeIds":{"shape":"Seu","locationName":"VolumeId"},"Filters":{"shape":"S7e","locationName":"Filter"},"NextToken":{"locationName":"nextToken"},"MaxResults":{"locationName":"maxResults","type":"integer"}}},"output":{"type":"structure","members":{"Volumes":{"locationName":"volumeSet","type":"list","member":{"shape":"S5i","locationName":"item"}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeVpcAttribute":{"input":{"type":"structure","required":["VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcId":{},"Attribute":{}}},"output":{"type":"structure","members":{"VpcId":{"locationName":"vpcId"},"EnableDnsSupport":{"shape":"S9y","locationName":"enableDnsSupport"},"EnableDnsHostnames":{"shape":"S9y","locationName":"enableDnsHostnames"}}},"http":{}},"DescribeVpcClassicLink":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcIds":{"locationName":"VpcId","type":"list","member":{"locationName":"VpcId"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"Vpcs":{"locationName":"vpcSet","type":"list","member":{"locationName":"item","type":"structure","members":{"VpcId":{"locationName":"vpcId"},"ClassicLinkEnabled":{"locationName":"classicLinkEnabled","type":"boolean"},"Tags":{"shape":"Sa","locationName":"tagSet"}}}}}},"http":{}},"DescribeVpcEndpointServices":{"input":{"type":"structure","members":{"DryRun":{"type":"boolean"},"MaxResults":{"type":"integer"},"NextToken":{}}},"output":{"type":"structure","members":{"ServiceNames":{"shape":"S22","locationName":"serviceNameSet"},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeVpcEndpoints":{"input":{"type":"structure","members":{"DryRun":{"type":"boolean"},"VpcEndpointIds":{"shape":"S22","locationName":"VpcEndpointId"},"Filters":{"shape":"S7e","locationName":"Filter"},"MaxResults":{"type":"integer"},"NextToken":{}}},"output":{"type":"structure","members":{"VpcEndpoints":{"locationName":"vpcEndpointSet","type":"list","member":{"shape":"S5s","locationName":"item"}},"NextToken":{"locationName":"nextToken"}}},"http":{}},"DescribeVpcPeeringConnections":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcPeeringConnectionIds":{"shape":"S22","locationName":"VpcPeeringConnectionId"},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"VpcPeeringConnections":{"locationName":"vpcPeeringConnectionSet","type":"list","member":{"shape":"S5","locationName":"item"}}}},"http":{}},"DescribeVpcs":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcIds":{"locationName":"VpcId","type":"list","member":{"locationName":"VpcId"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"Vpcs":{"locationName":"vpcSet","type":"list","member":{"shape":"S5o","locationName":"item"}}}},"http":{}},"DescribeVpnConnections":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpnConnectionIds":{"locationName":"VpnConnectionId","type":"list","member":{"locationName":"VpnConnectionId"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"VpnConnections":{"locationName":"vpnConnectionSet","type":"list","member":{"shape":"S5z","locationName":"item"}}}},"http":{}},"DescribeVpnGateways":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpnGatewayIds":{"locationName":"VpnGatewayId","type":"list","member":{"locationName":"VpnGatewayId"}},"Filters":{"shape":"S7e","locationName":"Filter"}}},"output":{"type":"structure","members":{"VpnGateways":{"locationName":"vpnGatewaySet","type":"list","member":{"shape":"S6b","locationName":"item"}}}},"http":{}},"DetachClassicLinkVpc":{"input":{"type":"structure","required":["InstanceId","VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{"locationName":"instanceId"},"VpcId":{"locationName":"vpcId"}}},"output":{"type":"structure","members":{"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"DetachInternetGateway":{"input":{"type":"structure","required":["InternetGatewayId","VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InternetGatewayId":{"locationName":"internetGatewayId"},"VpcId":{"locationName":"vpcId"}}},"http":{}},"DetachNetworkInterface":{"input":{"type":"structure","required":["AttachmentId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"AttachmentId":{"locationName":"attachmentId"},"Force":{"locationName":"force","type":"boolean"}}},"http":{}},"DetachVolume":{"input":{"type":"structure","required":["VolumeId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeId":{},"InstanceId":{},"Device":{},"Force":{"type":"boolean"}}},"output":{"shape":"Su","locationName":"attachment"},"http":{}},"DetachVpnGateway":{"input":{"type":"structure","required":["VpnGatewayId","VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpnGatewayId":{},"VpcId":{}}},"http":{}},"DisableVgwRoutePropagation":{"input":{"type":"structure","required":["RouteTableId","GatewayId"],"members":{"RouteTableId":{},"GatewayId":{}}},"http":{}},"DisableVpcClassicLink":{"input":{"type":"structure","required":["VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcId":{"locationName":"vpcId"}}},"output":{"type":"structure","members":{"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"DisassociateAddress":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"PublicIp":{},"AssociationId":{}}},"http":{}},"DisassociateRouteTable":{"input":{"type":"structure","required":["AssociationId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"AssociationId":{"locationName":"associationId"}}},"http":{}},"EnableVgwRoutePropagation":{"input":{"type":"structure","required":["RouteTableId","GatewayId"],"members":{"RouteTableId":{},"GatewayId":{}}},"http":{}},"EnableVolumeIO":{"input":{"type":"structure","required":["VolumeId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeId":{"locationName":"volumeId"}}},"http":{}},"EnableVpcClassicLink":{"input":{"type":"structure","required":["VpcId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcId":{"locationName":"vpcId"}}},"output":{"type":"structure","members":{"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"GetConsoleOutput":{"input":{"type":"structure","required":["InstanceId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{}}},"output":{"type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"Timestamp":{"locationName":"timestamp","type":"timestamp"},"Output":{"locationName":"output"}}},"http":{}},"GetPasswordData":{"input":{"type":"structure","required":["InstanceId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{}}},"output":{"type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"Timestamp":{"locationName":"timestamp","type":"timestamp"},"PasswordData":{"locationName":"passwordData"}}},"http":{}},"ImportImage":{"input":{"type":"structure","members":{"DryRun":{"type":"boolean"},"Description":{},"DiskContainers":{"locationName":"DiskContainer","type":"list","member":{"locationName":"item","type":"structure","members":{"Description":{},"Format":{},"Url":{},"UserBucket":{"shape":"Sgo"},"DeviceName":{},"SnapshotId":{}}}},"LicenseType":{},"Hypervisor":{},"Architecture":{},"Platform":{},"ClientData":{"shape":"Sgp"},"ClientToken":{},"RoleName":{}}},"output":{"type":"structure","members":{"ImportTaskId":{"locationName":"importTaskId"},"Architecture":{"locationName":"architecture"},"LicenseType":{"locationName":"licenseType"},"Platform":{"locationName":"platform"},"Hypervisor":{"locationName":"hypervisor"},"Description":{"locationName":"description"},"SnapshotDetails":{"shape":"S9n","locationName":"snapshotDetailSet"},"ImageId":{"locationName":"imageId"},"Progress":{"locationName":"progress"},"StatusMessage":{"locationName":"statusMessage"},"Status":{"locationName":"status"}}},"http":{}},"ImportInstance":{"input":{"type":"structure","required":["Platform"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Description":{"locationName":"description"},"LaunchSpecification":{"locationName":"launchSpecification","type":"structure","members":{"Architecture":{"locationName":"architecture"},"GroupNames":{"shape":"Sgt","locationName":"GroupName"},"GroupIds":{"shape":"S46","locationName":"GroupId"},"AdditionalInfo":{"locationName":"additionalInfo"},"UserData":{"locationName":"userData","type":"structure","members":{"Data":{"locationName":"data"}}},"InstanceType":{"locationName":"instanceType"},"Placement":{"shape":"Sao","locationName":"placement"},"Monitoring":{"locationName":"monitoring","type":"boolean"},"SubnetId":{"locationName":"subnetId"},"InstanceInitiatedShutdownBehavior":{"locationName":"instanceInitiatedShutdownBehavior"},"PrivateIpAddress":{"locationName":"privateIpAddress"}}},"DiskImages":{"locationName":"diskImage","type":"list","member":{"type":"structure","members":{"Image":{"shape":"Sgy"},"Description":{},"Volume":{"shape":"Sgz"}}}},"Platform":{"locationName":"platform"}}},"output":{"type":"structure","members":{"ConversionTask":{"shape":"S85","locationName":"conversionTask"}}},"http":{}},"ImportKeyPair":{"input":{"type":"structure","required":["KeyName","PublicKeyMaterial"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"KeyName":{"locationName":"keyName"},"PublicKeyMaterial":{"locationName":"publicKeyMaterial","type":"blob"}}},"output":{"type":"structure","members":{"KeyName":{"locationName":"keyName"},"KeyFingerprint":{"locationName":"keyFingerprint"}}},"http":{}},"ImportSnapshot":{"input":{"type":"structure","members":{"DryRun":{"type":"boolean"},"Description":{},"DiskContainer":{"type":"structure","members":{"Description":{},"Format":{},"Url":{},"UserBucket":{"shape":"Sgo"}}},"ClientData":{"shape":"Sgp"},"ClientToken":{},"RoleName":{}}},"output":{"type":"structure","members":{"ImportTaskId":{"locationName":"importTaskId"},"SnapshotTaskDetail":{"shape":"S9u","locationName":"snapshotTaskDetail"},"Description":{"locationName":"description"}}},"http":{}},"ImportVolume":{"input":{"type":"structure","required":["AvailabilityZone","Image","Volume"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"AvailabilityZone":{"locationName":"availabilityZone"},"Image":{"shape":"Sgy","locationName":"image"},"Description":{"locationName":"description"},"Volume":{"shape":"Sgz","locationName":"volume"}}},"output":{"type":"structure","members":{"ConversionTask":{"shape":"S85","locationName":"conversionTask"}}},"http":{}},"ModifyImageAttribute":{"input":{"type":"structure","required":["ImageId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ImageId":{},"Attribute":{},"OperationType":{},"UserIds":{"shape":"Sh9","locationName":"UserId"},"UserGroups":{"locationName":"UserGroup","type":"list","member":{"locationName":"UserGroup"}},"ProductCodes":{"locationName":"ProductCode","type":"list","member":{"locationName":"ProductCode"}},"Value":{},"LaunchPermission":{"type":"structure","members":{"Add":{"shape":"S8x"},"Remove":{"shape":"S8x"}}},"Description":{"shape":"S2z"}}},"http":{}},"ModifyInstanceAttribute":{"input":{"type":"structure","required":["InstanceId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{"locationName":"instanceId"},"Attribute":{"locationName":"attribute"},"Value":{"locationName":"value"},"BlockDeviceMappings":{"locationName":"blockDeviceMapping","type":"list","member":{"locationName":"item","type":"structure","members":{"DeviceName":{"locationName":"deviceName"},"Ebs":{"locationName":"ebs","type":"structure","members":{"VolumeId":{"locationName":"volumeId"},"DeleteOnTermination":{"locationName":"deleteOnTermination","type":"boolean"}}},"VirtualName":{"locationName":"virtualName"},"NoDevice":{"locationName":"noDevice"}}}},"SourceDestCheck":{"shape":"S9y"},"DisableApiTermination":{"shape":"S9y","locationName":"disableApiTermination"},"InstanceType":{"shape":"S2z","locationName":"instanceType"},"Kernel":{"shape":"S2z","locationName":"kernel"},"Ramdisk":{"shape":"S2z","locationName":"ramdisk"},"UserData":{"locationName":"userData","type":"structure","members":{"Value":{"locationName":"value","type":"blob"}}},"InstanceInitiatedShutdownBehavior":{"shape":"S2z","locationName":"instanceInitiatedShutdownBehavior"},"Groups":{"shape":"So","locationName":"GroupId"},"EbsOptimized":{"shape":"S9y","locationName":"ebsOptimized"},"SriovNetSupport":{"shape":"S2z","locationName":"sriovNetSupport"}}},"http":{}},"ModifyNetworkInterfaceAttribute":{"input":{"type":"structure","required":["NetworkInterfaceId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"Description":{"shape":"S2z","locationName":"description"},"SourceDestCheck":{"shape":"S9y","locationName":"sourceDestCheck"},"Groups":{"shape":"S46","locationName":"SecurityGroupId"},"Attachment":{"locationName":"attachment","type":"structure","members":{"AttachmentId":{"locationName":"attachmentId"},"DeleteOnTermination":{"locationName":"deleteOnTermination","type":"boolean"}}}}},"http":{}},"ModifyReservedInstances":{"input":{"type":"structure","required":["ReservedInstancesIds","TargetConfigurations"],"members":{"ClientToken":{"locationName":"clientToken"},"ReservedInstancesIds":{"shape":"Sc2","locationName":"ReservedInstancesId"},"TargetConfigurations":{"locationName":"ReservedInstancesConfigurationSetItemType","type":"list","member":{"shape":"Sco","locationName":"item"}}}},"output":{"type":"structure","members":{"ReservedInstancesModificationId":{"locationName":"reservedInstancesModificationId"}}},"http":{}},"ModifySnapshotAttribute":{"input":{"type":"structure","required":["SnapshotId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SnapshotId":{},"Attribute":{},"OperationType":{},"UserIds":{"shape":"Sh9","locationName":"UserId"},"GroupNames":{"shape":"Sd0","locationName":"UserGroup"},"CreateVolumePermission":{"type":"structure","members":{"Add":{"shape":"Sd7"},"Remove":{"shape":"Sd7"}}}}},"http":{}},"ModifySubnetAttribute":{"input":{"type":"structure","required":["SubnetId"],"members":{"SubnetId":{"locationName":"subnetId"},"MapPublicIpOnLaunch":{"shape":"S9y"}}},"http":{}},"ModifyVolumeAttribute":{"input":{"type":"structure","required":["VolumeId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VolumeId":{},"AutoEnableIO":{"shape":"S9y"}}},"http":{}},"ModifyVpcAttribute":{"input":{"type":"structure","required":["VpcId"],"members":{"VpcId":{"locationName":"vpcId"},"EnableDnsSupport":{"shape":"S9y"},"EnableDnsHostnames":{"shape":"S9y"}}},"http":{}},"ModifyVpcEndpoint":{"input":{"type":"structure","required":["VpcEndpointId"],"members":{"DryRun":{"type":"boolean"},"VpcEndpointId":{},"ResetPolicy":{"type":"boolean"},"PolicyDocument":{},"AddRouteTableIds":{"shape":"S22","locationName":"AddRouteTableId"},"RemoveRouteTableIds":{"shape":"S22","locationName":"RemoveRouteTableId"}}},"output":{"type":"structure","members":{"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"MonitorInstances":{"input":{"type":"structure","required":["InstanceIds"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceIds":{"shape":"S7x","locationName":"InstanceId"}}},"output":{"type":"structure","members":{"InstanceMonitorings":{"shape":"Shw","locationName":"instancesSet"}}},"http":{}},"MoveAddressToVpc":{"input":{"type":"structure","required":["PublicIp"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"PublicIp":{"locationName":"publicIp"}}},"output":{"type":"structure","members":{"AllocationId":{"locationName":"allocationId"},"Status":{"locationName":"status"}}},"http":{}},"PurchaseReservedInstancesOffering":{"input":{"type":"structure","required":["ReservedInstancesOfferingId","InstanceCount"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ReservedInstancesOfferingId":{},"InstanceCount":{"type":"integer"},"LimitPrice":{"locationName":"limitPrice","type":"structure","members":{"Amount":{"locationName":"amount","type":"double"},"CurrencyCode":{"locationName":"currencyCode"}}}}},"output":{"type":"structure","members":{"ReservedInstancesId":{"locationName":"reservedInstancesId"}}},"http":{}},"RebootInstances":{"input":{"type":"structure","required":["InstanceIds"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceIds":{"shape":"S7x","locationName":"InstanceId"}}},"http":{}},"RegisterImage":{"input":{"type":"structure","required":["Name"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ImageLocation":{},"Name":{"locationName":"name"},"Description":{"locationName":"description"},"Architecture":{"locationName":"architecture"},"KernelId":{"locationName":"kernelId"},"RamdiskId":{"locationName":"ramdiskId"},"RootDeviceName":{"locationName":"rootDeviceName"},"BlockDeviceMappings":{"shape":"S38","locationName":"BlockDeviceMapping"},"VirtualizationType":{"locationName":"virtualizationType"},"SriovNetSupport":{"locationName":"sriovNetSupport"}}},"output":{"type":"structure","members":{"ImageId":{"locationName":"imageId"}}},"http":{}},"RejectVpcPeeringConnection":{"input":{"type":"structure","required":["VpcPeeringConnectionId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"VpcPeeringConnectionId":{"locationName":"vpcPeeringConnectionId"}}},"output":{"type":"structure","members":{"Return":{"locationName":"return","type":"boolean"}}},"http":{}},"ReleaseAddress":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"PublicIp":{},"AllocationId":{}}},"http":{}},"ReplaceNetworkAclAssociation":{"input":{"type":"structure","required":["AssociationId","NetworkAclId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"AssociationId":{"locationName":"associationId"},"NetworkAclId":{"locationName":"networkAclId"}}},"output":{"type":"structure","members":{"NewAssociationId":{"locationName":"newAssociationId"}}},"http":{}},"ReplaceNetworkAclEntry":{"input":{"type":"structure","required":["NetworkAclId","RuleNumber","Protocol","RuleAction","Egress","CidrBlock"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkAclId":{"locationName":"networkAclId"},"RuleNumber":{"locationName":"ruleNumber","type":"integer"},"Protocol":{"locationName":"protocol"},"RuleAction":{"locationName":"ruleAction"},"Egress":{"locationName":"egress","type":"boolean"},"CidrBlock":{"locationName":"cidrBlock"},"IcmpTypeCode":{"shape":"S40","locationName":"Icmp"},"PortRange":{"shape":"S41","locationName":"portRange"}}},"http":{}},"ReplaceRoute":{"input":{"type":"structure","required":["RouteTableId","DestinationCidrBlock"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"RouteTableId":{"locationName":"routeTableId"},"DestinationCidrBlock":{"locationName":"destinationCidrBlock"},"GatewayId":{"locationName":"gatewayId"},"InstanceId":{"locationName":"instanceId"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"VpcPeeringConnectionId":{"locationName":"vpcPeeringConnectionId"}}},"http":{}},"ReplaceRouteTableAssociation":{"input":{"type":"structure","required":["AssociationId","RouteTableId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"AssociationId":{"locationName":"associationId"},"RouteTableId":{"locationName":"routeTableId"}}},"output":{"type":"structure","members":{"NewAssociationId":{"locationName":"newAssociationId"}}},"http":{}},"ReportInstanceStatus":{"input":{"type":"structure","required":["Instances","Status","ReasonCodes"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"Instances":{"shape":"S7x","locationName":"instanceId"},"Status":{"locationName":"status"},"StartTime":{"locationName":"startTime","type":"timestamp"},"EndTime":{"locationName":"endTime","type":"timestamp"},"ReasonCodes":{"locationName":"reasonCode","type":"list","member":{"locationName":"item"}},"Description":{"locationName":"description"}}},"http":{}},"RequestSpotFleet":{"input":{"type":"structure","required":["SpotFleetRequestConfig"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SpotFleetRequestConfig":{"shape":"Sdu","locationName":"spotFleetRequestConfig"}}},"output":{"type":"structure","required":["SpotFleetRequestId"],"members":{"SpotFleetRequestId":{"locationName":"spotFleetRequestId"}}},"http":{}},"RequestSpotInstances":{"input":{"type":"structure","required":["SpotPrice"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SpotPrice":{"locationName":"spotPrice"},"ClientToken":{"locationName":"clientToken"},"InstanceCount":{"locationName":"instanceCount","type":"integer"},"Type":{"locationName":"type"},"ValidFrom":{"locationName":"validFrom","type":"timestamp"},"ValidUntil":{"locationName":"validUntil","type":"timestamp"},"LaunchGroup":{"locationName":"launchGroup"},"AvailabilityZoneGroup":{"locationName":"availabilityZoneGroup"},"LaunchSpecification":{"type":"structure","members":{"ImageId":{"locationName":"imageId"},"KeyName":{"locationName":"keyName"},"SecurityGroups":{"shape":"S22","locationName":"SecurityGroup"},"UserData":{"locationName":"userData"},"AddressingType":{"locationName":"addressingType"},"InstanceType":{"locationName":"instanceType"},"Placement":{"shape":"Sdx","locationName":"placement"},"KernelId":{"locationName":"kernelId"},"RamdiskId":{"locationName":"ramdiskId"},"BlockDeviceMappings":{"shape":"S93","locationName":"blockDeviceMapping"},"SubnetId":{"locationName":"subnetId"},"NetworkInterfaces":{"shape":"Sdz","locationName":"NetworkInterface"},"IamInstanceProfile":{"shape":"Se1","locationName":"iamInstanceProfile"},"EbsOptimized":{"locationName":"ebsOptimized","type":"boolean"},"Monitoring":{"shape":"Sea","locationName":"monitoring"},"SecurityGroupIds":{"shape":"S22","locationName":"SecurityGroupId"}}}}},"output":{"type":"structure","members":{"SpotInstanceRequests":{"shape":"Se4","locationName":"spotInstanceRequestSet"}}},"http":{}},"ResetImageAttribute":{"input":{"type":"structure","required":["ImageId","Attribute"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ImageId":{},"Attribute":{}}},"http":{}},"ResetInstanceAttribute":{"input":{"type":"structure","required":["InstanceId","Attribute"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceId":{"locationName":"instanceId"},"Attribute":{"locationName":"attribute"}}},"http":{}},"ResetNetworkInterfaceAttribute":{"input":{"type":"structure","required":["NetworkInterfaceId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"SourceDestCheck":{"locationName":"sourceDestCheck"}}},"http":{}},"ResetSnapshotAttribute":{"input":{"type":"structure","required":["SnapshotId","Attribute"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"SnapshotId":{},"Attribute":{}}},"http":{}},"RestoreAddressToClassic":{"input":{"type":"structure","required":["PublicIp"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"PublicIp":{"locationName":"publicIp"}}},"output":{"type":"structure","members":{"Status":{"locationName":"status"},"PublicIp":{"locationName":"publicIp"}}},"http":{}},"RevokeSecurityGroupEgress":{"input":{"type":"structure","required":["GroupId"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupId":{"locationName":"groupId"},"SourceSecurityGroupName":{"locationName":"sourceSecurityGroupName"},"SourceSecurityGroupOwnerId":{"locationName":"sourceSecurityGroupOwnerId"},"IpProtocol":{"locationName":"ipProtocol"},"FromPort":{"locationName":"fromPort","type":"integer"},"ToPort":{"locationName":"toPort","type":"integer"},"CidrIp":{"locationName":"cidrIp"},"IpPermissions":{"shape":"S11","locationName":"ipPermissions"}}},"http":{}},"RevokeSecurityGroupIngress":{"input":{"type":"structure","members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"GroupName":{},"GroupId":{},"SourceSecurityGroupName":{},"SourceSecurityGroupOwnerId":{},"IpProtocol":{},"FromPort":{"type":"integer"},"ToPort":{"type":"integer"},"CidrIp":{},"IpPermissions":{"shape":"S11"}}},"http":{}},"RunInstances":{"input":{"type":"structure","required":["ImageId","MinCount","MaxCount"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"ImageId":{},"MinCount":{"type":"integer"},"MaxCount":{"type":"integer"},"KeyName":{},"SecurityGroups":{"shape":"Sgt","locationName":"SecurityGroup"},"SecurityGroupIds":{"shape":"S46","locationName":"SecurityGroupId"},"UserData":{},"InstanceType":{},"Placement":{"shape":"Sao"},"KernelId":{},"RamdiskId":{},"BlockDeviceMappings":{"shape":"S38","locationName":"BlockDeviceMapping"},"Monitoring":{"shape":"Sea"},"SubnetId":{},"DisableApiTermination":{"locationName":"disableApiTermination","type":"boolean"},"InstanceInitiatedShutdownBehavior":{"locationName":"instanceInitiatedShutdownBehavior"},"PrivateIpAddress":{"locationName":"privateIpAddress"},"ClientToken":{"locationName":"clientToken"},"AdditionalInfo":{"locationName":"additionalInfo"},"NetworkInterfaces":{"shape":"Sdz","locationName":"networkInterface"},"IamInstanceProfile":{"shape":"Se1","locationName":"iamInstanceProfile"},"EbsOptimized":{"locationName":"ebsOptimized","type":"boolean"}}},"output":{"shape":"Sak","locationName":"reservation"},"http":{}},"StartInstances":{"input":{"type":"structure","required":["InstanceIds"],"members":{"InstanceIds":{"shape":"S7x","locationName":"InstanceId"},"AdditionalInfo":{"locationName":"additionalInfo"},"DryRun":{"locationName":"dryRun","type":"boolean"}}},"output":{"type":"structure","members":{"StartingInstances":{"shape":"Sj1","locationName":"instancesSet"}}},"http":{}},"StopInstances":{"input":{"type":"structure","required":["InstanceIds"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceIds":{"shape":"S7x","locationName":"InstanceId"},"Force":{"locationName":"force","type":"boolean"}}},"output":{"type":"structure","members":{"StoppingInstances":{"shape":"Sj1","locationName":"instancesSet"}}},"http":{}},"TerminateInstances":{"input":{"type":"structure","required":["InstanceIds"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceIds":{"shape":"S7x","locationName":"InstanceId"}}},"output":{"type":"structure","members":{"TerminatingInstances":{"shape":"Sj1","locationName":"instancesSet"}}},"http":{}},"UnassignPrivateIpAddresses":{"input":{"type":"structure","required":["NetworkInterfaceId","PrivateIpAddresses"],"members":{"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"PrivateIpAddresses":{"shape":"Sg","locationName":"privateIpAddress"}}},"http":{}},"UnmonitorInstances":{"input":{"type":"structure","required":["InstanceIds"],"members":{"DryRun":{"locationName":"dryRun","type":"boolean"},"InstanceIds":{"shape":"S7x","locationName":"InstanceId"}}},"output":{"type":"structure","members":{"InstanceMonitorings":{"shape":"Shw","locationName":"instancesSet"}}},"http":{}}},"shapes":{"S5":{"type":"structure","members":{"AccepterVpcInfo":{"shape":"S6","locationName":"accepterVpcInfo"},"ExpirationTime":{"locationName":"expirationTime","type":"timestamp"},"RequesterVpcInfo":{"shape":"S6","locationName":"requesterVpcInfo"},"Status":{"locationName":"status","type":"structure","members":{"Code":{"locationName":"code"},"Message":{"locationName":"message"}}},"Tags":{"shape":"Sa","locationName":"tagSet"},"VpcPeeringConnectionId":{"locationName":"vpcPeeringConnectionId"}}},"S6":{"type":"structure","members":{"CidrBlock":{"locationName":"cidrBlock"},"OwnerId":{"locationName":"ownerId"},"VpcId":{"locationName":"vpcId"}}},"Sa":{"type":"list","member":{"locationName":"item","type":"structure","members":{"Key":{"locationName":"key"},"Value":{"locationName":"value"}}}},"Sg":{"type":"list","member":{"locationName":"PrivateIpAddress"}},"So":{"type":"list","member":{"locationName":"groupId"}},"Su":{"type":"structure","members":{"VolumeId":{"locationName":"volumeId"},"InstanceId":{"locationName":"instanceId"},"Device":{"locationName":"device"},"State":{"locationName":"status"},"AttachTime":{"locationName":"attachTime","type":"timestamp"},"DeleteOnTermination":{"locationName":"deleteOnTermination","type":"boolean"}}},"Sy":{"type":"structure","members":{"VpcId":{"locationName":"vpcId"},"State":{"locationName":"state"}}},"S11":{"type":"list","member":{"locationName":"item","type":"structure","members":{"IpProtocol":{"locationName":"ipProtocol"},"FromPort":{"locationName":"fromPort","type":"integer"},"ToPort":{"locationName":"toPort","type":"integer"},"UserIdGroupPairs":{"locationName":"groups","type":"list","member":{"locationName":"item","type":"structure","members":{"UserId":{"locationName":"userId"},"GroupName":{"locationName":"groupName"},"GroupId":{"locationName":"groupId"}}}},"IpRanges":{"locationName":"ipRanges","type":"list","member":{"locationName":"item","type":"structure","members":{"CidrIp":{"locationName":"cidrIp"}}}},"PrefixListIds":{"locationName":"prefixListIds","type":"list","member":{"locationName":"item","type":"structure","members":{"PrefixListId":{"locationName":"prefixListId"}}}}}}},"S1b":{"type":"structure","members":{"S3":{"type":"structure","members":{"Bucket":{"locationName":"bucket"},"Prefix":{"locationName":"prefix"},"AWSAccessKeyId":{},"UploadPolicy":{"locationName":"uploadPolicy","type":"blob"},"UploadPolicySignature":{"locationName":"uploadPolicySignature"}}}}},"S1f":{"type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"BundleId":{"locationName":"bundleId"},"State":{"locationName":"state"},"StartTime":{"locationName":"startTime","type":"timestamp"},"UpdateTime":{"locationName":"updateTime","type":"timestamp"},"Storage":{"shape":"S1b","locationName":"storage"},"Progress":{"locationName":"progress"},"BundleTaskError":{"locationName":"error","type":"structure","members":{"Code":{"locationName":"code"},"Message":{"locationName":"message"}}}}},"S1q":{"type":"list","member":{"locationName":"item","type":"structure","members":{"ReservedInstancesListingId":{"locationName":"reservedInstancesListingId"},"ReservedInstancesId":{"locationName":"reservedInstancesId"},"CreateDate":{"locationName":"createDate","type":"timestamp"},"UpdateDate":{"locationName":"updateDate","type":"timestamp"},"Status":{"locationName":"status"},"StatusMessage":{"locationName":"statusMessage"},"InstanceCounts":{"locationName":"instanceCounts","type":"list","member":{"locationName":"item","type":"structure","members":{"State":{"locationName":"state"},"InstanceCount":{"locationName":"instanceCount","type":"integer"}}}},"PriceSchedules":{"locationName":"priceSchedules","type":"list","member":{"locationName":"item","type":"structure","members":{"Term":{"locationName":"term","type":"long"},"Price":{"locationName":"price","type":"double"},"CurrencyCode":{"locationName":"currencyCode"},"Active":{"locationName":"active","type":"boolean"}}}},"Tags":{"shape":"Sa","locationName":"tagSet"},"ClientToken":{"locationName":"clientToken"}}}},"S22":{"type":"list","member":{"locationName":"item"}},"S2c":{"type":"list","member":{"locationName":"SpotInstanceRequestId"}},"S2q":{"type":"structure","members":{"CustomerGatewayId":{"locationName":"customerGatewayId"},"State":{"locationName":"state"},"Type":{"locationName":"type"},"IpAddress":{"locationName":"ipAddress"},"BgpAsn":{"locationName":"bgpAsn"},"Tags":{"shape":"Sa","locationName":"tagSet"}}},"S2v":{"type":"structure","members":{"DhcpOptionsId":{"locationName":"dhcpOptionsId"},"DhcpConfigurations":{"locationName":"dhcpConfigurationSet","type":"list","member":{"locationName":"item","type":"structure","members":{"Key":{"locationName":"key"},"Values":{"locationName":"valueSet","type":"list","member":{"shape":"S2z","locationName":"item"}}}}},"Tags":{"shape":"Sa","locationName":"tagSet"}}},"S2z":{"type":"structure","members":{"Value":{"locationName":"value"}}},"S34":{"type":"list","member":{"locationName":"item","type":"structure","required":["Error"],"members":{"ResourceId":{"locationName":"resourceId"},"Error":{"locationName":"error","type":"structure","required":["Code","Message"],"members":{"Code":{"locationName":"code"},"Message":{"locationName":"message"}}}}}},"S38":{"type":"list","member":{"shape":"S39","locationName":"BlockDeviceMapping"}},"S39":{"type":"structure","members":{"VirtualName":{"locationName":"virtualName"},"DeviceName":{"locationName":"deviceName"},"Ebs":{"locationName":"ebs","type":"structure","members":{"SnapshotId":{"locationName":"snapshotId"},"VolumeSize":{"locationName":"volumeSize","type":"integer"},"DeleteOnTermination":{"locationName":"deleteOnTermination","type":"boolean"},"VolumeType":{"locationName":"volumeType"},"Iops":{"locationName":"iops","type":"integer"},"Encrypted":{"locationName":"encrypted","type":"boolean"}}},"NoDevice":{"locationName":"noDevice"}}},"S3j":{"type":"structure","members":{"ExportTaskId":{"locationName":"exportTaskId"},"Description":{"locationName":"description"},"State":{"locationName":"state"},"StatusMessage":{"locationName":"statusMessage"},"InstanceExportDetails":{"locationName":"instanceExport","type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"TargetEnvironment":{"locationName":"targetEnvironment"}}},"ExportToS3Task":{"locationName":"exportToS3","type":"structure","members":{"DiskImageFormat":{"locationName":"diskImageFormat"},"ContainerFormat":{"locationName":"containerFormat"},"S3Bucket":{"locationName":"s3Bucket"},"S3Key":{"locationName":"s3Key"}}}}},"S3p":{"type":"structure","members":{"InternetGatewayId":{"locationName":"internetGatewayId"},"Attachments":{"locationName":"attachmentSet","type":"list","member":{"locationName":"item","type":"structure","members":{"VpcId":{"locationName":"vpcId"},"State":{"locationName":"state"}}}},"Tags":{"shape":"Sa","locationName":"tagSet"}}},"S3w":{"type":"structure","members":{"NetworkAclId":{"locationName":"networkAclId"},"VpcId":{"locationName":"vpcId"},"IsDefault":{"locationName":"default","type":"boolean"},"Entries":{"locationName":"entrySet","type":"list","member":{"locationName":"item","type":"structure","members":{"RuleNumber":{"locationName":"ruleNumber","type":"integer"},"Protocol":{"locationName":"protocol"},"RuleAction":{"locationName":"ruleAction"},"Egress":{"locationName":"egress","type":"boolean"},"CidrBlock":{"locationName":"cidrBlock"},"IcmpTypeCode":{"shape":"S40","locationName":"icmpTypeCode"},"PortRange":{"shape":"S41","locationName":"portRange"}}}},"Associations":{"locationName":"associationSet","type":"list","member":{"locationName":"item","type":"structure","members":{"NetworkAclAssociationId":{"locationName":"networkAclAssociationId"},"NetworkAclId":{"locationName":"networkAclId"},"SubnetId":{"locationName":"subnetId"}}}},"Tags":{"shape":"Sa","locationName":"tagSet"}}},"S40":{"type":"structure","members":{"Type":{"locationName":"type","type":"integer"},"Code":{"locationName":"code","type":"integer"}}},"S41":{"type":"structure","members":{"From":{"locationName":"from","type":"integer"},"To":{"locationName":"to","type":"integer"}}},"S46":{"type":"list","member":{"locationName":"SecurityGroupId"}},"S47":{"type":"list","member":{"locationName":"item","type":"structure","required":["PrivateIpAddress"],"members":{"PrivateIpAddress":{"locationName":"privateIpAddress"},"Primary":{"locationName":"primary","type":"boolean"}}}},"S4a":{"type":"structure","members":{"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"SubnetId":{"locationName":"subnetId"},"VpcId":{"locationName":"vpcId"},"AvailabilityZone":{"locationName":"availabilityZone"},"Description":{"locationName":"description"},"OwnerId":{"locationName":"ownerId"},"RequesterId":{"locationName":"requesterId"},"RequesterManaged":{"locationName":"requesterManaged","type":"boolean"},"Status":{"locationName":"status"},"MacAddress":{"locationName":"macAddress"},"PrivateIpAddress":{"locationName":"privateIpAddress"},"PrivateDnsName":{"locationName":"privateDnsName"},"SourceDestCheck":{"locationName":"sourceDestCheck","type":"boolean"},"Groups":{"shape":"S4c","locationName":"groupSet"},"Attachment":{"shape":"S4e","locationName":"attachment"},"Association":{"shape":"S4f","locationName":"association"},"TagSet":{"shape":"Sa","locationName":"tagSet"},"PrivateIpAddresses":{"locationName":"privateIpAddressesSet","type":"list","member":{"locationName":"item","type":"structure","members":{"PrivateIpAddress":{"locationName":"privateIpAddress"},"PrivateDnsName":{"locationName":"privateDnsName"},"Primary":{"locationName":"primary","type":"boolean"},"Association":{"shape":"S4f","locationName":"association"}}}}}},"S4c":{"type":"list","member":{"locationName":"item","type":"structure","members":{"GroupName":{"locationName":"groupName"},"GroupId":{"locationName":"groupId"}}}},"S4e":{"type":"structure","members":{"AttachmentId":{"locationName":"attachmentId"},"InstanceId":{"locationName":"instanceId"},"InstanceOwnerId":{"locationName":"instanceOwnerId"},"DeviceIndex":{"locationName":"deviceIndex","type":"integer"},"Status":{"locationName":"status"},"AttachTime":{"locationName":"attachTime","type":"timestamp"},"DeleteOnTermination":{"locationName":"deleteOnTermination","type":"boolean"}}},"S4f":{"type":"structure","members":{"PublicIp":{"locationName":"publicIp"},"PublicDnsName":{"locationName":"publicDnsName"},"IpOwnerId":{"locationName":"ipOwnerId"},"AllocationId":{"locationName":"allocationId"},"AssociationId":{"locationName":"associationId"}}},"S4s":{"type":"structure","members":{"RouteTableId":{"locationName":"routeTableId"},"VpcId":{"locationName":"vpcId"},"Routes":{"locationName":"routeSet","type":"list","member":{"locationName":"item","type":"structure","members":{"DestinationCidrBlock":{"locationName":"destinationCidrBlock"},"DestinationPrefixListId":{"locationName":"destinationPrefixListId"},"GatewayId":{"locationName":"gatewayId"},"InstanceId":{"locationName":"instanceId"},"InstanceOwnerId":{"locationName":"instanceOwnerId"},"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"VpcPeeringConnectionId":{"locationName":"vpcPeeringConnectionId"},"State":{"locationName":"state"},"Origin":{"locationName":"origin"}}}},"Associations":{"locationName":"associationSet","type":"list","member":{"locationName":"item","type":"structure","members":{"RouteTableAssociationId":{"locationName":"routeTableAssociationId"},"RouteTableId":{"locationName":"routeTableId"},"SubnetId":{"locationName":"subnetId"},"Main":{"locationName":"main","type":"boolean"}}}},"Tags":{"shape":"Sa","locationName":"tagSet"},"PropagatingVgws":{"locationName":"propagatingVgwSet","type":"list","member":{"locationName":"item","type":"structure","members":{"GatewayId":{"locationName":"gatewayId"}}}}}},"S54":{"type":"structure","members":{"SnapshotId":{"locationName":"snapshotId"},"VolumeId":{"locationName":"volumeId"},"State":{"locationName":"status"},"StartTime":{"locationName":"startTime","type":"timestamp"},"Progress":{"locationName":"progress"},"OwnerId":{"locationName":"ownerId"},"Description":{"locationName":"description"},"VolumeSize":{"locationName":"volumeSize","type":"integer"},"OwnerAlias":{"locationName":"ownerAlias"},"Tags":{"shape":"Sa","locationName":"tagSet"},"Encrypted":{"locationName":"encrypted","type":"boolean"},"KmsKeyId":{"locationName":"kmsKeyId"}}},"S58":{"type":"structure","members":{"OwnerId":{"locationName":"ownerId"},"Bucket":{"locationName":"bucket"},"Prefix":{"locationName":"prefix"},"State":{"locationName":"state"},"Fault":{"shape":"S5a","locationName":"fault"}}},"S5a":{"type":"structure","members":{"Code":{"locationName":"code"},"Message":{"locationName":"message"}}},"S5d":{"type":"structure","members":{"SubnetId":{"locationName":"subnetId"},"State":{"locationName":"state"},"VpcId":{"locationName":"vpcId"},"CidrBlock":{"locationName":"cidrBlock"},"AvailableIpAddressCount":{"locationName":"availableIpAddressCount","type":"integer"},"AvailabilityZone":{"locationName":"availabilityZone"},"DefaultForAz":{"locationName":"defaultForAz","type":"boolean"},"MapPublicIpOnLaunch":{"locationName":"mapPublicIpOnLaunch","type":"boolean"},"Tags":{"shape":"Sa","locationName":"tagSet"}}},"S5g":{"type":"list","member":{}},"S5i":{"type":"structure","members":{"VolumeId":{"locationName":"volumeId"},"Size":{"locationName":"size","type":"integer"},"SnapshotId":{"locationName":"snapshotId"},"AvailabilityZone":{"locationName":"availabilityZone"},"State":{"locationName":"status"},"CreateTime":{"locationName":"createTime","type":"timestamp"},"Attachments":{"locationName":"attachmentSet","type":"list","member":{"shape":"Su","locationName":"item"}},"Tags":{"shape":"Sa","locationName":"tagSet"},"VolumeType":{"locationName":"volumeType"},"Iops":{"locationName":"iops","type":"integer"},"Encrypted":{"locationName":"encrypted","type":"boolean"},"KmsKeyId":{"locationName":"kmsKeyId"}}},"S5o":{"type":"structure","members":{"VpcId":{"locationName":"vpcId"},"State":{"locationName":"state"},"CidrBlock":{"locationName":"cidrBlock"},"DhcpOptionsId":{"locationName":"dhcpOptionsId"},"Tags":{"shape":"Sa","locationName":"tagSet"},"InstanceTenancy":{"locationName":"instanceTenancy"},"IsDefault":{"locationName":"isDefault","type":"boolean"}}},"S5s":{"type":"structure","members":{"VpcEndpointId":{"locationName":"vpcEndpointId"},"VpcId":{"locationName":"vpcId"},"ServiceName":{"locationName":"serviceName"},"State":{"locationName":"state"},"PolicyDocument":{"locationName":"policyDocument"},"RouteTableIds":{"shape":"S22","locationName":"routeTableIdSet"},"CreationTimestamp":{"locationName":"creationTimestamp","type":"timestamp"}}},"S5z":{"type":"structure","members":{"VpnConnectionId":{"locationName":"vpnConnectionId"},"State":{"locationName":"state"},"CustomerGatewayConfiguration":{"locationName":"customerGatewayConfiguration"},"Type":{"locationName":"type"},"CustomerGatewayId":{"locationName":"customerGatewayId"},"VpnGatewayId":{"locationName":"vpnGatewayId"},"Tags":{"shape":"Sa","locationName":"tagSet"},"VgwTelemetry":{"locationName":"vgwTelemetry","type":"list","member":{"locationName":"item","type":"structure","members":{"OutsideIpAddress":{"locationName":"outsideIpAddress"},"Status":{"locationName":"status"},"LastStatusChange":{"locationName":"lastStatusChange","type":"timestamp"},"StatusMessage":{"locationName":"statusMessage"},"AcceptedRouteCount":{"locationName":"acceptedRouteCount","type":"integer"}}}},"Options":{"locationName":"options","type":"structure","members":{"StaticRoutesOnly":{"locationName":"staticRoutesOnly","type":"boolean"}}},"Routes":{"locationName":"routes","type":"list","member":{"locationName":"item","type":"structure","members":{"DestinationCidrBlock":{"locationName":"destinationCidrBlock"},"Source":{"locationName":"source"},"State":{"locationName":"state"}}}}}},"S6b":{"type":"structure","members":{"VpnGatewayId":{"locationName":"vpnGatewayId"},"State":{"locationName":"state"},"Type":{"locationName":"type"},"AvailabilityZone":{"locationName":"availabilityZone"},"VpcAttachments":{"locationName":"attachments","type":"list","member":{"shape":"Sy","locationName":"item"}},"Tags":{"shape":"Sa","locationName":"tagSet"}}},"S7e":{"type":"list","member":{"locationName":"Filter","type":"structure","members":{"Name":{},"Values":{"shape":"S22","locationName":"Value"}}}},"S7x":{"type":"list","member":{"locationName":"InstanceId"}},"S85":{"type":"structure","required":["ConversionTaskId","State"],"members":{"ConversionTaskId":{"locationName":"conversionTaskId"},"ExpirationTime":{"locationName":"expirationTime"},"ImportInstance":{"locationName":"importInstance","type":"structure","required":["Volumes"],"members":{"Volumes":{"locationName":"volumes","type":"list","member":{"locationName":"item","type":"structure","required":["BytesConverted","AvailabilityZone","Image","Volume","Status"],"members":{"BytesConverted":{"locationName":"bytesConverted","type":"long"},"AvailabilityZone":{"locationName":"availabilityZone"},"Image":{"shape":"S89","locationName":"image"},"Volume":{"shape":"S8a","locationName":"volume"},"Status":{"locationName":"status"},"StatusMessage":{"locationName":"statusMessage"},"Description":{"locationName":"description"}}}},"InstanceId":{"locationName":"instanceId"},"Platform":{"locationName":"platform"},"Description":{"locationName":"description"}}},"ImportVolume":{"locationName":"importVolume","type":"structure","required":["BytesConverted","AvailabilityZone","Image","Volume"],"members":{"BytesConverted":{"locationName":"bytesConverted","type":"long"},"AvailabilityZone":{"locationName":"availabilityZone"},"Description":{"locationName":"description"},"Image":{"shape":"S89","locationName":"image"},"Volume":{"shape":"S8a","locationName":"volume"}}},"State":{"locationName":"state"},"StatusMessage":{"locationName":"statusMessage"},"Tags":{"shape":"Sa","locationName":"tagSet"}}},"S89":{"type":"structure","required":["Format","Size","ImportManifestUrl"],"members":{"Format":{"locationName":"format"},"Size":{"locationName":"size","type":"long"},"ImportManifestUrl":{"locationName":"importManifestUrl"},"Checksum":{"locationName":"checksum"}}},"S8a":{"type":"structure","required":["Id"],"members":{"Size":{"locationName":"size","type":"long"},"Id":{"locationName":"id"}}},"S8x":{"type":"list","member":{"locationName":"item","type":"structure","members":{"UserId":{"locationName":"userId"},"Group":{"locationName":"group"}}}},"S90":{"type":"list","member":{"locationName":"item","type":"structure","members":{"ProductCodeId":{"locationName":"productCode"},"ProductCodeType":{"locationName":"type"}}}},"S93":{"type":"list","member":{"shape":"S39","locationName":"item"}},"S96":{"type":"list","member":{"locationName":"Owner"}},"S9e":{"type":"structure","members":{"Code":{"locationName":"code"},"Message":{"locationName":"message"}}},"S9j":{"type":"list","member":{"locationName":"ImportTaskId"}},"S9n":{"type":"list","member":{"locationName":"item","type":"structure","members":{"DiskImageSize":{"locationName":"diskImageSize","type":"double"},"Description":{"locationName":"description"},"Format":{"locationName":"format"},"Url":{"locationName":"url"},"UserBucket":{"shape":"S9p","locationName":"userBucket"},"DeviceName":{"locationName":"deviceName"},"SnapshotId":{"locationName":"snapshotId"},"Progress":{"locationName":"progress"},"StatusMessage":{"locationName":"statusMessage"},"Status":{"locationName":"status"}}}},"S9p":{"type":"structure","members":{"S3Bucket":{"locationName":"s3Bucket"},"S3Key":{"locationName":"s3Key"}}},"S9u":{"type":"structure","members":{"DiskImageSize":{"locationName":"diskImageSize","type":"double"},"Description":{"locationName":"description"},"Format":{"locationName":"format"},"Url":{"locationName":"url"},"UserBucket":{"shape":"S9p","locationName":"userBucket"},"SnapshotId":{"locationName":"snapshotId"},"Progress":{"locationName":"progress"},"StatusMessage":{"locationName":"statusMessage"},"Status":{"locationName":"status"}}},"S9y":{"type":"structure","members":{"Value":{"locationName":"value","type":"boolean"}}},"S9z":{"type":"list","member":{"locationName":"item","type":"structure","members":{"DeviceName":{"locationName":"deviceName"},"Ebs":{"locationName":"ebs","type":"structure","members":{"VolumeId":{"locationName":"volumeId"},"Status":{"locationName":"status"},"AttachTime":{"locationName":"attachTime","type":"timestamp"},"DeleteOnTermination":{"locationName":"deleteOnTermination","type":"boolean"}}}}}},"Sa9":{"type":"structure","members":{"Code":{"locationName":"code","type":"integer"},"Name":{"locationName":"name"}}},"Sab":{"type":"structure","members":{"Status":{"locationName":"status"},"Details":{"locationName":"details","type":"list","member":{"locationName":"item","type":"structure","members":{"Name":{"locationName":"name"},"Status":{"locationName":"status"},"ImpairedSince":{"locationName":"impairedSince","type":"timestamp"}}}}}},"Sak":{"type":"structure","members":{"ReservationId":{"locationName":"reservationId"},"OwnerId":{"locationName":"ownerId"},"RequesterId":{"locationName":"requesterId"},"Groups":{"shape":"S4c","locationName":"groupSet"},"Instances":{"locationName":"instancesSet","type":"list","member":{"locationName":"item","type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"ImageId":{"locationName":"imageId"},"State":{"shape":"Sa9","locationName":"instanceState"},"PrivateDnsName":{"locationName":"privateDnsName"},"PublicDnsName":{"locationName":"dnsName"},"StateTransitionReason":{"locationName":"reason"},"KeyName":{"locationName":"keyName"},"AmiLaunchIndex":{"locationName":"amiLaunchIndex","type":"integer"},"ProductCodes":{"shape":"S90","locationName":"productCodes"},"InstanceType":{"locationName":"instanceType"},"LaunchTime":{"locationName":"launchTime","type":"timestamp"},"Placement":{"shape":"Sao","locationName":"placement"},"KernelId":{"locationName":"kernelId"},"RamdiskId":{"locationName":"ramdiskId"},"Platform":{"locationName":"platform"},"Monitoring":{"shape":"Sap","locationName":"monitoring"},"SubnetId":{"locationName":"subnetId"},"VpcId":{"locationName":"vpcId"},"PrivateIpAddress":{"locationName":"privateIpAddress"},"PublicIpAddress":{"locationName":"ipAddress"},"StateReason":{"shape":"S9e","locationName":"stateReason"},"Architecture":{"locationName":"architecture"},"RootDeviceType":{"locationName":"rootDeviceType"},"RootDeviceName":{"locationName":"rootDeviceName"},"BlockDeviceMappings":{"shape":"S9z","locationName":"blockDeviceMapping"},"VirtualizationType":{"locationName":"virtualizationType"},"InstanceLifecycle":{"locationName":"instanceLifecycle"},"SpotInstanceRequestId":{"locationName":"spotInstanceRequestId"},"ClientToken":{"locationName":"clientToken"},"Tags":{"shape":"Sa","locationName":"tagSet"},"SecurityGroups":{"shape":"S4c","locationName":"groupSet"},"SourceDestCheck":{"locationName":"sourceDestCheck","type":"boolean"},"Hypervisor":{"locationName":"hypervisor"},"NetworkInterfaces":{"locationName":"networkInterfaceSet","type":"list","member":{"locationName":"item","type":"structure","members":{"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"SubnetId":{"locationName":"subnetId"},"VpcId":{"locationName":"vpcId"},"Description":{"locationName":"description"},"OwnerId":{"locationName":"ownerId"},"Status":{"locationName":"status"},"MacAddress":{"locationName":"macAddress"},"PrivateIpAddress":{"locationName":"privateIpAddress"},"PrivateDnsName":{"locationName":"privateDnsName"},"SourceDestCheck":{"locationName":"sourceDestCheck","type":"boolean"},"Groups":{"shape":"S4c","locationName":"groupSet"},"Attachment":{"locationName":"attachment","type":"structure","members":{"AttachmentId":{"locationName":"attachmentId"},"DeviceIndex":{"locationName":"deviceIndex","type":"integer"},"Status":{"locationName":"status"},"AttachTime":{"locationName":"attachTime","type":"timestamp"},"DeleteOnTermination":{"locationName":"deleteOnTermination","type":"boolean"}}},"Association":{"shape":"Sav","locationName":"association"},"PrivateIpAddresses":{"locationName":"privateIpAddressesSet","type":"list","member":{"locationName":"item","type":"structure","members":{"PrivateIpAddress":{"locationName":"privateIpAddress"},"PrivateDnsName":{"locationName":"privateDnsName"},"Primary":{"locationName":"primary","type":"boolean"},"Association":{"shape":"Sav","locationName":"association"}}}}}}},"IamInstanceProfile":{"locationName":"iamInstanceProfile","type":"structure","members":{"Arn":{"locationName":"arn"},"Id":{"locationName":"id"}}},"EbsOptimized":{"locationName":"ebsOptimized","type":"boolean"},"SriovNetSupport":{"locationName":"sriovNetSupport"}}}}}},"Sao":{"type":"structure","members":{"AvailabilityZone":{"locationName":"availabilityZone"},"GroupName":{"locationName":"groupName"},"Tenancy":{"locationName":"tenancy"}}},"Sap":{"type":"structure","members":{"State":{"locationName":"state"}}},"Sav":{"type":"structure","members":{"PublicIp":{"locationName":"publicIp"},"PublicDnsName":{"locationName":"publicDnsName"},"IpOwnerId":{"locationName":"ipOwnerId"}}},"Sc2":{"type":"list","member":{"locationName":"ReservedInstancesId"}},"Sca":{"type":"list","member":{"locationName":"item","type":"structure","members":{"Frequency":{"locationName":"frequency"},"Amount":{"locationName":"amount","type":"double"}}}},"Sco":{"type":"structure","members":{"AvailabilityZone":{"locationName":"availabilityZone"},"Platform":{"locationName":"platform"},"InstanceCount":{"locationName":"instanceCount","type":"integer"},"InstanceType":{"locationName":"instanceType"}}},"Sd0":{"type":"list","member":{"locationName":"GroupName"}},"Sd7":{"type":"list","member":{"locationName":"item","type":"structure","members":{"UserId":{"locationName":"userId"},"Group":{"locationName":"group"}}}},"Sdu":{"type":"structure","required":["SpotPrice","TargetCapacity","IamFleetRole","LaunchSpecifications"],"members":{"ClientToken":{"locationName":"clientToken"},"SpotPrice":{"locationName":"spotPrice"},"TargetCapacity":{"locationName":"targetCapacity","type":"integer"},"ValidFrom":{"locationName":"validFrom","type":"timestamp"},"ValidUntil":{"locationName":"validUntil","type":"timestamp"},"TerminateInstancesWithExpiration":{"locationName":"terminateInstancesWithExpiration","type":"boolean"},"IamFleetRole":{"locationName":"iamFleetRole"},"LaunchSpecifications":{"locationName":"launchSpecifications","type":"list","member":{"locationName":"item","type":"structure","members":{"ImageId":{"locationName":"imageId"},"KeyName":{"locationName":"keyName"},"SecurityGroups":{"shape":"S4c","locationName":"groupSet"},"UserData":{"locationName":"userData"},"AddressingType":{"locationName":"addressingType"},"InstanceType":{"locationName":"instanceType"},"Placement":{"shape":"Sdx","locationName":"placement"},"KernelId":{"locationName":"kernelId"},"RamdiskId":{"locationName":"ramdiskId"},"BlockDeviceMappings":{"shape":"S93","locationName":"blockDeviceMapping"},"Monitoring":{"locationName":"monitoring","type":"structure","members":{"Enabled":{"locationName":"enabled","type":"boolean"}}},"SubnetId":{"locationName":"subnetId"},"NetworkInterfaces":{"shape":"Sdz","locationName":"networkInterfaceSet"},"IamInstanceProfile":{"shape":"Se1","locationName":"iamInstanceProfile"},"EbsOptimized":{"locationName":"ebsOptimized","type":"boolean"}}}}}},"Sdx":{"type":"structure","members":{"AvailabilityZone":{"locationName":"availabilityZone"},"GroupName":{"locationName":"groupName"}}},"Sdz":{"type":"list","member":{"locationName":"item","type":"structure","members":{"NetworkInterfaceId":{"locationName":"networkInterfaceId"},"DeviceIndex":{"locationName":"deviceIndex","type":"integer"},"SubnetId":{"locationName":"subnetId"},"Description":{"locationName":"description"},"PrivateIpAddress":{"locationName":"privateIpAddress"},"Groups":{"shape":"S46","locationName":"SecurityGroupId"},"DeleteOnTermination":{"locationName":"deleteOnTermination","type":"boolean"},"PrivateIpAddresses":{"shape":"S47","locationName":"privateIpAddressesSet","queryName":"PrivateIpAddresses"},"SecondaryPrivateIpAddressCount":{"locationName":"secondaryPrivateIpAddressCount","type":"integer"},"AssociatePublicIpAddress":{"locationName":"associatePublicIpAddress","type":"boolean"}}}},"Se1":{"type":"structure","members":{"Arn":{"locationName":"arn"},"Name":{"locationName":"name"}}},"Se4":{"type":"list","member":{"locationName":"item","type":"structure","members":{"SpotInstanceRequestId":{"locationName":"spotInstanceRequestId"},"SpotPrice":{"locationName":"spotPrice"},"Type":{"locationName":"type"},"State":{"locationName":"state"},"Fault":{"shape":"S5a","locationName":"fault"},"Status":{"locationName":"status","type":"structure","members":{"Code":{"locationName":"code"},"UpdateTime":{"locationName":"updateTime","type":"timestamp"},"Message":{"locationName":"message"}}},"ValidFrom":{"locationName":"validFrom","type":"timestamp"},"ValidUntil":{"locationName":"validUntil","type":"timestamp"},"LaunchGroup":{"locationName":"launchGroup"},"AvailabilityZoneGroup":{"locationName":"availabilityZoneGroup"},"LaunchSpecification":{"locationName":"launchSpecification","type":"structure","members":{"ImageId":{"locationName":"imageId"},"KeyName":{"locationName":"keyName"},"SecurityGroups":{"shape":"S4c","locationName":"groupSet"},"UserData":{"locationName":"userData"},"AddressingType":{"locationName":"addressingType"},"InstanceType":{"locationName":"instanceType"},"Placement":{"shape":"Sdx","locationName":"placement"},"KernelId":{"locationName":"kernelId"},"RamdiskId":{"locationName":"ramdiskId"},"BlockDeviceMappings":{"shape":"S93","locationName":"blockDeviceMapping"},"SubnetId":{"locationName":"subnetId"},"NetworkInterfaces":{"shape":"Sdz","locationName":"networkInterfaceSet"},"IamInstanceProfile":{"shape":"Se1","locationName":"iamInstanceProfile"},"EbsOptimized":{"locationName":"ebsOptimized","type":"boolean"},"Monitoring":{"shape":"Sea","locationName":"monitoring"}}},"InstanceId":{"locationName":"instanceId"},"CreateTime":{"locationName":"createTime","type":"timestamp"},"ProductDescription":{"locationName":"productDescription"},"Tags":{"shape":"Sa","locationName":"tagSet"},"LaunchedAvailabilityZone":{"locationName":"launchedAvailabilityZone"}}}},"Sea":{"type":"structure","required":["Enabled"],"members":{"Enabled":{"locationName":"enabled","type":"boolean"}}},"Seu":{"type":"list","member":{"locationName":"VolumeId"}},"Sgo":{"type":"structure","members":{"S3Bucket":{},"S3Key":{}}},"Sgp":{"type":"structure","members":{"UploadStart":{"type":"timestamp"},"UploadEnd":{"type":"timestamp"},"UploadSize":{"type":"double"},"Comment":{}}},"Sgt":{"type":"list","member":{"locationName":"SecurityGroup"}},"Sgy":{"type":"structure","required":["Format","Bytes","ImportManifestUrl"],"members":{"Format":{"locationName":"format"},"Bytes":{"locationName":"bytes","type":"long"},"ImportManifestUrl":{"locationName":"importManifestUrl"}}},"Sgz":{"type":"structure","required":["Size"],"members":{"Size":{"locationName":"size","type":"long"}}},"Sh9":{"type":"list","member":{"locationName":"UserId"}},"Shw":{"type":"list","member":{"locationName":"item","type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"Monitoring":{"shape":"Sap","locationName":"monitoring"}}}},"Sj1":{"type":"list","member":{"locationName":"item","type":"structure","members":{"InstanceId":{"locationName":"instanceId"},"CurrentState":{"shape":"Sa9","locationName":"currentState"},"PreviousState":{"shape":"Sa9","locationName":"previousState"}}}}},"examples":{},"paginators":{"DescribeAccountAttributes":{"result_key":"AccountAttributes"},"DescribeAddresses":{"result_key":"Addresses"},"DescribeAvailabilityZones":{"result_key":"AvailabilityZones"},"DescribeBundleTasks":{"result_key":"BundleTasks"},"DescribeConversionTasks":{"result_key":"ConversionTasks"},"DescribeCustomerGateways":{"result_key":"CustomerGateways"},"DescribeDhcpOptions":{"result_key":"DhcpOptions"},"DescribeExportTasks":{"result_key":"ExportTasks"},"DescribeImages":{"result_key":"Images"},"DescribeInstanceStatus":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxResults","result_key":"InstanceStatuses"},"DescribeInstances":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxResults","result_key":"Reservations"},"DescribeInternetGateways":{"result_key":"InternetGateways"},"DescribeKeyPairs":{"result_key":"KeyPairs"},"DescribeNetworkAcls":{"result_key":"NetworkAcls"},"DescribeNetworkInterfaces":{"result_key":"NetworkInterfaces"},"DescribePlacementGroups":{"result_key":"PlacementGroups"},"DescribeRegions":{"result_key":"Regions"},"DescribeReservedInstances":{"result_key":"ReservedInstances"},"DescribeReservedInstancesListings":{"result_key":"ReservedInstancesListings"},"DescribeReservedInstancesOfferings":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxResults","result_key":"ReservedInstancesOfferings"},"DescribeReservedInstancesModifications":{"input_token":"NextToken","output_token":"NextToken","result_key":"ReservedInstancesModifications"},"DescribeRouteTables":{"result_key":"RouteTables"},"DescribeSecurityGroups":{"result_key":"SecurityGroups"},"DescribeSnapshots":{"input_token":"NextToken","output_token":"NextToken","result_key":"Snapshots"},"DescribeSpotInstanceRequests":{"result_key":"SpotInstanceRequests"},"DescribeSpotPriceHistory":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxResults","result_key":"SpotPriceHistory"},"DescribeSubnets":{"result_key":"Subnets"},"DescribeTags":{"result_key":"Tags"},"DescribeVolumeStatus":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxResults","result_key":"VolumeStatuses"},"DescribeVolumes":{"input_token":"NextToken","output_token":"NextToken","limit_key":"MaxResults","result_key":"Volumes"},"DescribeVpcs":{"result_key":"Vpcs"},"DescribeVpnConnections":{"result_key":"VpnConnections"},"DescribeVpnGateways":{"result_key":"VpnGateways"}},"waiters":{"__default__":{"interval":15,"max_attempts":40,"acceptor_type":"output"},"__InstanceState":{"operation":"DescribeInstances","acceptor_path":"Reservations[].Instances[].State.Name"},"__InstanceStatus":{"operation":"DescribeInstanceStatus","success_value":"ok"},"SystemStatusOk":{"extends":"__InstanceStatus","acceptor_path":"InstanceStatuses[].SystemStatus.Status"},"InstanceStatusOk":{"extends":"__InstanceStatus","acceptor_path":"InstanceStatuses[].InstanceStatus.Status"},"ImageAvailable":{"operation":"DescribeImages","acceptor_path":"Images[].State","success_value":"available","failure_value":["failed"]},"InstanceRunning":{"extends":"__InstanceState","success_value":"running","failure_value":["shutting-down","terminated","stopping"]},"InstanceStopped":{"extends":"__InstanceState","success_value":"stopped","failure_value":["pending","terminated"]},"InstanceTerminated":{"extends":"__InstanceState","success_value":"terminated","failure_value":["pending","stopping"]},"__ExportTaskState":{"operation":"DescribeExportTasks","acceptor_path":"ExportTasks[].State"},"ExportTaskCompleted":{"extends":"__ExportTaskState","success_value":"completed"},"ExportTaskCancelled":{"extends":"__ExportTaskState","success_value":"cancelled"},"SnapshotCompleted":{"operation":"DescribeSnapshots","success_path":"Snapshots[].State","success_value":"completed"},"SubnetAvailable":{"operation":"DescribeSubnets","success_path":"Subnets[].State","success_value":"available"},"__VolumeStatus":{"operation":"DescribeVolumes","acceptor_path":"Volumes[].State"},"VolumeAvailable":{"extends":"__VolumeStatus","success_value":"available","failure_value":["deleted"]},"VolumeInUse":{"extends":"__VolumeStatus","success_value":"in-use","failure_value":["deleted"]},"VolumeDeleted":{"extends":"__VolumeStatus","success_type":"error","success_value":"InvalidVolume.NotFound"},"VpcAvailable":{"operation":"DescribeVpcs","success_path":"Vpcs[].State","success_value":"available"},"__VpnConnectionState":{"operation":"DescribeVpnConnections","acceptor_path":"VpnConnections[].State"},"VpnConnectionAvailable":{"extends":"__VpnConnectionState","success_value":"available","failure_value":["deleting","deleted"]},"VpnConnectionDeleted":{"extends":"__VpnConnectionState","success_value":"deleted","failure_value":["pending"]},"BundleTaskComplete":{"operation":"DescribeBundleTasks","acceptor_path":"BundleTasks[].State","success_value":"complete","failure_value":["failed"]},"__ConversionTaskState":{"operation":"DescribeConversionTasks","acceptor_path":"ConversionTasks[].State"},"ConversionTaskCompleted":{"extends":"__ConversionTaskState","success_value":"completed","failure_value":["cancelled","cancelling"]},"ConversionTaskCancelled":{"extends":"__ConversionTaskState","success_value":"cancelled"},"__CustomerGatewayState":{"operation":"DescribeCustomerGateways","acceptor_path":"CustomerGateways[].State"},"CustomerGatewayAvailable":{"extends":"__CustomerGatewayState","success_value":"available","failure_value":["deleted","deleting"]},"ConversionTaskDeleted":{"extends":"__CustomerGatewayState","success_value":"deleted"},"__SpotInstanceRequestState":{"operation":"DescribeSpotInstanceRequests","acceptor_path":"SpotInstanceRequests[].Status.Code"},"SpotInstanceRequestFulfilled":{"extends":"__SpotInstanceRequestState","success_value":"fulfilled","failure_value":["schedule-expired","canceled-before-fulfillment","bad-parameters","system-error"]}}};
AWS.apiLoader.services['elastictranscoder'] = {};
AWS.ElasticTranscoder = AWS.Service.defineService('elastictranscoder', [ '2012-09-25' ]);

AWS.apiLoader.services['elastictranscoder']['2012-09-25'] = {"version":"2.0","metadata":{"apiVersion":"2012-09-25","endpointPrefix":"elastictranscoder","serviceFullName":"Amazon Elastic Transcoder","signatureVersion":"v4","protocol":"rest-json"},"operations":{"CancelJob":{"http":{"method":"DELETE","requestUri":"/2012-09-25/jobs/{Id}","responseCode":202},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{}}},"CreateJob":{"http":{"requestUri":"/2012-09-25/jobs","responseCode":201},"input":{"type":"structure","required":["PipelineId","Input"],"members":{"PipelineId":{},"Input":{"shape":"S5"},"Output":{"shape":"Sk"},"Outputs":{"type":"list","member":{"shape":"Sk"}},"OutputKeyPrefix":{},"Playlists":{"type":"list","member":{"type":"structure","members":{"Name":{},"Format":{},"OutputKeys":{"shape":"S1i"},"HlsContentProtection":{"shape":"S1j"},"PlayReadyDrm":{"shape":"S1n"}}}},"UserMetadata":{"shape":"S1s"}}},"output":{"type":"structure","members":{"Job":{"shape":"S1v"}}}},"CreatePipeline":{"http":{"requestUri":"/2012-09-25/pipelines","responseCode":201},"input":{"type":"structure","required":["Name","InputBucket","Role"],"members":{"Name":{},"InputBucket":{},"OutputBucket":{},"Role":{},"AwsKmsKeyArn":{},"Notifications":{"shape":"S27"},"ContentConfig":{"shape":"S29"},"ThumbnailConfig":{"shape":"S29"}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S2i"},"Warnings":{"shape":"S2k"}}}},"CreatePreset":{"http":{"requestUri":"/2012-09-25/presets","responseCode":201},"input":{"type":"structure","required":["Name","Container"],"members":{"Name":{},"Description":{},"Container":{},"Video":{"shape":"S2o"},"Audio":{"shape":"S34"},"Thumbnails":{"shape":"S3f"}}},"output":{"type":"structure","members":{"Preset":{"shape":"S3j"},"Warning":{}}}},"DeletePipeline":{"http":{"method":"DELETE","requestUri":"/2012-09-25/pipelines/{Id}","responseCode":202},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{}}},"DeletePreset":{"http":{"method":"DELETE","requestUri":"/2012-09-25/presets/{Id}","responseCode":202},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{}}},"ListJobsByPipeline":{"http":{"method":"GET","requestUri":"/2012-09-25/jobsByPipeline/{PipelineId}"},"input":{"type":"structure","required":["PipelineId"],"members":{"PipelineId":{"location":"uri","locationName":"PipelineId"},"Ascending":{"location":"querystring","locationName":"Ascending"},"PageToken":{"location":"querystring","locationName":"PageToken"}}},"output":{"type":"structure","members":{"Jobs":{"shape":"S3s"},"NextPageToken":{}}}},"ListJobsByStatus":{"http":{"method":"GET","requestUri":"/2012-09-25/jobsByStatus/{Status}"},"input":{"type":"structure","required":["Status"],"members":{"Status":{"location":"uri","locationName":"Status"},"Ascending":{"location":"querystring","locationName":"Ascending"},"PageToken":{"location":"querystring","locationName":"PageToken"}}},"output":{"type":"structure","members":{"Jobs":{"shape":"S3s"},"NextPageToken":{}}}},"ListPipelines":{"http":{"method":"GET","requestUri":"/2012-09-25/pipelines"},"input":{"type":"structure","members":{"Ascending":{"location":"querystring","locationName":"Ascending"},"PageToken":{"location":"querystring","locationName":"PageToken"}}},"output":{"type":"structure","members":{"Pipelines":{"type":"list","member":{"shape":"S2i"}},"NextPageToken":{}}}},"ListPresets":{"http":{"method":"GET","requestUri":"/2012-09-25/presets"},"input":{"type":"structure","members":{"Ascending":{"location":"querystring","locationName":"Ascending"},"PageToken":{"location":"querystring","locationName":"PageToken"}}},"output":{"type":"structure","members":{"Presets":{"type":"list","member":{"shape":"S3j"}},"NextPageToken":{}}}},"ReadJob":{"http":{"method":"GET","requestUri":"/2012-09-25/jobs/{Id}"},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{"Job":{"shape":"S1v"}}}},"ReadPipeline":{"http":{"method":"GET","requestUri":"/2012-09-25/pipelines/{Id}"},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S2i"},"Warnings":{"shape":"S2k"}}}},"ReadPreset":{"http":{"method":"GET","requestUri":"/2012-09-25/presets/{Id}"},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"}}},"output":{"type":"structure","members":{"Preset":{"shape":"S3j"}}}},"TestRole":{"http":{"requestUri":"/2012-09-25/roleTests","responseCode":200},"input":{"type":"structure","required":["Role","InputBucket","OutputBucket","Topics"],"members":{"Role":{},"InputBucket":{},"OutputBucket":{},"Topics":{"type":"list","member":{}}}},"output":{"type":"structure","members":{"Success":{},"Messages":{"type":"list","member":{}}}}},"UpdatePipeline":{"http":{"method":"PUT","requestUri":"/2012-09-25/pipelines/{Id}","responseCode":200},"input":{"type":"structure","required":["Id"],"members":{"Id":{"location":"uri","locationName":"Id"},"Name":{},"InputBucket":{},"Role":{},"AwsKmsKeyArn":{},"Notifications":{"shape":"S27"},"ContentConfig":{"shape":"S29"},"ThumbnailConfig":{"shape":"S29"}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S2i"},"Warnings":{"shape":"S2k"}}}},"UpdatePipelineNotifications":{"http":{"requestUri":"/2012-09-25/pipelines/{Id}/notifications"},"input":{"type":"structure","required":["Id","Notifications"],"members":{"Id":{"location":"uri","locationName":"Id"},"Notifications":{"shape":"S27"}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S2i"}}}},"UpdatePipelineStatus":{"http":{"requestUri":"/2012-09-25/pipelines/{Id}/status"},"input":{"type":"structure","required":["Id","Status"],"members":{"Id":{"location":"uri","locationName":"Id"},"Status":{}}},"output":{"type":"structure","members":{"Pipeline":{"shape":"S2i"}}}}},"shapes":{"S5":{"type":"structure","members":{"Key":{},"FrameRate":{},"Resolution":{},"AspectRatio":{},"Interlaced":{},"Container":{},"Encryption":{"shape":"Sc"},"DetectedProperties":{"type":"structure","members":{"Width":{"type":"integer"},"Height":{"type":"integer"},"FrameRate":{},"FileSize":{"type":"long"},"DurationMillis":{"type":"long"}}}}},"Sc":{"type":"structure","members":{"Mode":{},"Key":{},"KeyMd5":{},"InitializationVector":{}}},"Sk":{"type":"structure","members":{"Key":{},"ThumbnailPattern":{},"ThumbnailEncryption":{"shape":"Sc"},"Rotate":{},"PresetId":{},"SegmentDuration":{},"Watermarks":{"shape":"Sn"},"AlbumArt":{"shape":"Sr"},"Composition":{"shape":"Sz"},"Captions":{"shape":"S13"},"Encryption":{"shape":"Sc"}}},"Sn":{"type":"list","member":{"type":"structure","members":{"PresetWatermarkId":{},"InputKey":{},"Encryption":{"shape":"Sc"}}}},"Sr":{"type":"structure","members":{"MergePolicy":{},"Artwork":{"type":"list","member":{"type":"structure","members":{"InputKey":{},"MaxWidth":{},"MaxHeight":{},"SizingPolicy":{},"PaddingPolicy":{},"AlbumArtFormat":{},"Encryption":{"shape":"Sc"}}}}}},"Sz":{"type":"list","member":{"type":"structure","members":{"TimeSpan":{"type":"structure","members":{"StartTime":{},"Duration":{}}}}}},"S13":{"type":"structure","members":{"MergePolicy":{},"CaptionSources":{"type":"list","member":{"type":"structure","members":{"Key":{},"Language":{},"TimeOffset":{},"Label":{},"Encryption":{"shape":"Sc"}}}},"CaptionFormats":{"type":"list","member":{"type":"structure","members":{"Format":{},"Pattern":{},"Encryption":{"shape":"Sc"}}}}}},"S1i":{"type":"list","member":{}},"S1j":{"type":"structure","members":{"Method":{},"Key":{},"KeyMd5":{},"InitializationVector":{},"LicenseAcquisitionUrl":{},"KeyStoragePolicy":{}}},"S1n":{"type":"structure","members":{"Format":{},"Key":{},"KeyMd5":{},"KeyId":{},"InitializationVector":{},"LicenseAcquisitionUrl":{}}},"S1s":{"type":"map","key":{},"value":{}},"S1v":{"type":"structure","members":{"Id":{},"Arn":{},"PipelineId":{},"Input":{"shape":"S5"},"Output":{"shape":"S1w"},"Outputs":{"type":"list","member":{"shape":"S1w"}},"OutputKeyPrefix":{},"Playlists":{"type":"list","member":{"type":"structure","members":{"Name":{},"Format":{},"OutputKeys":{"shape":"S1i"},"HlsContentProtection":{"shape":"S1j"},"PlayReadyDrm":{"shape":"S1n"},"Status":{},"StatusDetail":{}}}},"Status":{},"UserMetadata":{"shape":"S1s"},"Timing":{"type":"structure","members":{"SubmitTimeMillis":{"type":"long"},"StartTimeMillis":{"type":"long"},"FinishTimeMillis":{"type":"long"}}}}},"S1w":{"type":"structure","members":{"Id":{},"Key":{},"ThumbnailPattern":{},"ThumbnailEncryption":{"shape":"Sc"},"Rotate":{},"PresetId":{},"SegmentDuration":{},"Status":{},"StatusDetail":{},"Duration":{"type":"long"},"Width":{"type":"integer"},"Height":{"type":"integer"},"FrameRate":{},"FileSize":{"type":"long"},"DurationMillis":{"type":"long"},"Watermarks":{"shape":"Sn"},"AlbumArt":{"shape":"Sr"},"Composition":{"shape":"Sz"},"Captions":{"shape":"S13"},"Encryption":{"shape":"Sc"},"AppliedColorSpaceConversion":{}}},"S27":{"type":"structure","members":{"Progressing":{},"Completed":{},"Warning":{},"Error":{}}},"S29":{"type":"structure","members":{"Bucket":{},"StorageClass":{},"Permissions":{"type":"list","member":{"type":"structure","members":{"GranteeType":{},"Grantee":{},"Access":{"type":"list","member":{}}}}}}},"S2i":{"type":"structure","members":{"Id":{},"Arn":{},"Name":{},"Status":{},"InputBucket":{},"OutputBucket":{},"Role":{},"AwsKmsKeyArn":{},"Notifications":{"shape":"S27"},"ContentConfig":{"shape":"S29"},"ThumbnailConfig":{"shape":"S29"}}},"S2k":{"type":"list","member":{"type":"structure","members":{"Code":{},"Message":{}}}},"S2o":{"type":"structure","members":{"Codec":{},"CodecOptions":{"type":"map","key":{},"value":{}},"KeyframesMaxDist":{},"FixedGOP":{},"BitRate":{},"FrameRate":{},"MaxFrameRate":{},"Resolution":{},"AspectRatio":{},"MaxWidth":{},"MaxHeight":{},"DisplayAspectRatio":{},"SizingPolicy":{},"PaddingPolicy":{},"Watermarks":{"type":"list","member":{"type":"structure","members":{"Id":{},"MaxWidth":{},"MaxHeight":{},"SizingPolicy":{},"HorizontalAlign":{},"HorizontalOffset":{},"VerticalAlign":{},"VerticalOffset":{},"Opacity":{},"Target":{}}}}}},"S34":{"type":"structure","members":{"Codec":{},"SampleRate":{},"BitRate":{},"Channels":{},"AudioPackingMode":{},"CodecOptions":{"type":"structure","members":{"Profile":{},"BitDepth":{},"BitOrder":{},"Signed":{}}}}},"S3f":{"type":"structure","members":{"Format":{},"Interval":{},"Resolution":{},"AspectRatio":{},"MaxWidth":{},"MaxHeight":{},"SizingPolicy":{},"PaddingPolicy":{}}},"S3j":{"type":"structure","members":{"Id":{},"Arn":{},"Name":{},"Description":{},"Container":{},"Audio":{"shape":"S34"},"Video":{"shape":"S2o"},"Thumbnails":{"shape":"S3f"},"Type":{}}},"S3s":{"type":"list","member":{"shape":"S1v"}}},"paginators":{"ListJobsByPipeline":{"input_token":"PageToken","output_token":"NextPageToken","result_key":"Jobs"},"ListJobsByStatus":{"input_token":"PageToken","output_token":"NextPageToken","result_key":"Jobs"},"ListPipelines":{"input_token":"PageToken","output_token":"NextPageToken","result_key":"Pipelines"},"ListPresets":{"input_token":"PageToken","output_token":"NextPageToken","result_key":"Presets"}},"waiters":{"JobComplete":{"operation":"ReadJob","success_type":"output","success_path":"Job.Status","interval":30,"max_attempts":120,"success_value":"Complete","failure_value":["Canceled","Error"]}}};
AWS.apiLoader.services['kinesis'] = {};
AWS.Kinesis = AWS.Service.defineService('kinesis', [ '2013-12-02' ]);

AWS.apiLoader.services['kinesis']['2013-12-02'] = {"version":"2.0","metadata":{"apiVersion":"2013-12-02","endpointPrefix":"kinesis","jsonVersion":"1.1","serviceAbbreviation":"Kinesis","serviceFullName":"Amazon Kinesis","signatureVersion":"v4","targetPrefix":"Kinesis_20131202","protocol":"json"},"operations":{"AddTagsToStream":{"input":{"type":"structure","required":["StreamName","Tags"],"members":{"StreamName":{},"Tags":{"type":"map","key":{},"value":{}}}},"http":{}},"CreateStream":{"input":{"type":"structure","required":["StreamName","ShardCount"],"members":{"StreamName":{},"ShardCount":{"type":"integer"}}},"http":{}},"DeleteStream":{"input":{"type":"structure","required":["StreamName"],"members":{"StreamName":{}}},"http":{}},"DescribeStream":{"input":{"type":"structure","required":["StreamName"],"members":{"StreamName":{},"Limit":{"type":"integer"},"ExclusiveStartShardId":{}}},"output":{"type":"structure","required":["StreamDescription"],"members":{"StreamDescription":{"type":"structure","required":["StreamName","StreamARN","StreamStatus","Shards","HasMoreShards"],"members":{"StreamName":{},"StreamARN":{},"StreamStatus":{},"Shards":{"type":"list","member":{"type":"structure","required":["ShardId","HashKeyRange","SequenceNumberRange"],"members":{"ShardId":{},"ParentShardId":{},"AdjacentParentShardId":{},"HashKeyRange":{"type":"structure","required":["StartingHashKey","EndingHashKey"],"members":{"StartingHashKey":{},"EndingHashKey":{}}},"SequenceNumberRange":{"type":"structure","required":["StartingSequenceNumber"],"members":{"StartingSequenceNumber":{},"EndingSequenceNumber":{}}}}}},"HasMoreShards":{"type":"boolean"}}}}},"http":{}},"GetRecords":{"input":{"type":"structure","required":["ShardIterator"],"members":{"ShardIterator":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","required":["Records"],"members":{"Records":{"type":"list","member":{"type":"structure","required":["SequenceNumber","Data","PartitionKey"],"members":{"SequenceNumber":{},"Data":{"type":"blob"},"PartitionKey":{}}}},"NextShardIterator":{},"MillisBehindLatest":{"type":"long"}}},"http":{}},"GetShardIterator":{"input":{"type":"structure","required":["StreamName","ShardId","ShardIteratorType"],"members":{"StreamName":{},"ShardId":{},"ShardIteratorType":{},"StartingSequenceNumber":{}}},"output":{"type":"structure","members":{"ShardIterator":{}}},"http":{}},"ListStreams":{"input":{"type":"structure","members":{"Limit":{"type":"integer"},"ExclusiveStartStreamName":{}}},"output":{"type":"structure","required":["StreamNames","HasMoreStreams"],"members":{"StreamNames":{"type":"list","member":{}},"HasMoreStreams":{"type":"boolean"}}},"http":{}},"ListTagsForStream":{"input":{"type":"structure","required":["StreamName"],"members":{"StreamName":{},"ExclusiveStartTagKey":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","required":["Tags","HasMoreTags"],"members":{"Tags":{"type":"list","member":{"type":"structure","required":["Key"],"members":{"Key":{},"Value":{}}}},"HasMoreTags":{"type":"boolean"}}},"http":{}},"MergeShards":{"input":{"type":"structure","required":["StreamName","ShardToMerge","AdjacentShardToMerge"],"members":{"StreamName":{},"ShardToMerge":{},"AdjacentShardToMerge":{}}},"http":{}},"PutRecord":{"input":{"type":"structure","required":["StreamName","Data","PartitionKey"],"members":{"StreamName":{},"Data":{"type":"blob"},"PartitionKey":{},"ExplicitHashKey":{},"SequenceNumberForOrdering":{}}},"output":{"type":"structure","required":["ShardId","SequenceNumber"],"members":{"ShardId":{},"SequenceNumber":{}}},"http":{}},"PutRecords":{"input":{"type":"structure","required":["Records","StreamName"],"members":{"Records":{"type":"list","member":{"type":"structure","required":["Data","PartitionKey"],"members":{"Data":{"type":"blob"},"ExplicitHashKey":{},"PartitionKey":{}}}},"StreamName":{}}},"output":{"type":"structure","required":["Records"],"members":{"FailedRecordCount":{"type":"integer"},"Records":{"type":"list","member":{"type":"structure","members":{"SequenceNumber":{},"ShardId":{},"ErrorCode":{},"ErrorMessage":{}}}}}},"http":{}},"RemoveTagsFromStream":{"input":{"type":"structure","required":["StreamName","TagKeys"],"members":{"StreamName":{},"TagKeys":{"type":"list","member":{}}}},"http":{}},"SplitShard":{"input":{"type":"structure","required":["StreamName","ShardToSplit","NewStartingHashKey"],"members":{"StreamName":{},"ShardToSplit":{},"NewStartingHashKey":{}}},"http":{}}},"shapes":{},"paginators":{"DescribeStream":{"input_token":"ExclusiveStartShardId","limit_key":"Limit","more_results":"StreamDescription.HasMoreShards","output_token":"StreamDescription.Shards[-1].ShardId","result_key":"StreamDescription.Shards"},"ListStreams":{"input_token":"ExclusiveStartStreamName","limit_key":"Limit","more_results":"HasMoreStreams","output_token":"StreamNames[-1]","result_key":"StreamNames"}}};
AWS.apiLoader.services['lambda'] = {};
AWS.Lambda = AWS.Service.defineService('lambda', [ '2014-11-11', '2015-03-31' ]);

AWS.apiLoader.services['lambda']['2015-03-31'] = {"version":"2.0","metadata":{"apiVersion":"2015-03-31","endpointPrefix":"lambda","serviceFullName":"AWS Lambda","signatureVersion":"v4","protocol":"rest-json"},"operations":{"AddPermission":{"http":{"requestUri":"/2015-03-31/functions/{FunctionName}/versions/HEAD/policy","responseCode":201},"input":{"type":"structure","required":["FunctionName","StatementId","Action","Principal"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"},"StatementId":{},"Action":{},"Principal":{},"SourceArn":{},"SourceAccount":{}}},"output":{"type":"structure","members":{"Statement":{}}}},"CreateEventSourceMapping":{"http":{"requestUri":"/2015-03-31/event-source-mappings/","responseCode":202},"input":{"type":"structure","required":["EventSourceArn","FunctionName","StartingPosition"],"members":{"EventSourceArn":{},"FunctionName":{},"Enabled":{"type":"boolean"},"BatchSize":{"type":"integer"},"StartingPosition":{}}},"output":{"shape":"Se"}},"CreateFunction":{"http":{"requestUri":"/2015-03-31/functions","responseCode":201},"input":{"type":"structure","required":["FunctionName","Runtime","Role","Handler","Code"],"members":{"FunctionName":{},"Runtime":{},"Role":{},"Handler":{},"Description":{},"Timeout":{"type":"integer"},"MemorySize":{"type":"integer"},"Code":{"type":"structure","members":{"ZipFile":{"type":"blob"},"S3Bucket":{},"S3Key":{},"S3ObjectVersion":{}}}}},"output":{"shape":"St"}},"DeleteEventSourceMapping":{"http":{"method":"DELETE","requestUri":"/2015-03-31/event-source-mappings/{UUID}","responseCode":202},"input":{"type":"structure","required":["UUID"],"members":{"UUID":{"location":"uri","locationName":"UUID"}}},"output":{"shape":"Se"}},"DeleteFunction":{"http":{"method":"DELETE","requestUri":"/2015-03-31/functions/{FunctionName}","responseCode":204},"input":{"type":"structure","required":["FunctionName"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"}}}},"GetEventSourceMapping":{"http":{"method":"GET","requestUri":"/2015-03-31/event-source-mappings/{UUID}","responseCode":200},"input":{"type":"structure","required":["UUID"],"members":{"UUID":{"location":"uri","locationName":"UUID"}}},"output":{"shape":"Se"}},"GetFunction":{"http":{"method":"GET","requestUri":"/2015-03-31/functions/{FunctionName}/versions/HEAD","responseCode":200},"input":{"type":"structure","required":["FunctionName"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"}}},"output":{"type":"structure","members":{"Configuration":{"shape":"St"},"Code":{"type":"structure","members":{"RepositoryType":{},"Location":{}}}}}},"GetFunctionConfiguration":{"http":{"method":"GET","requestUri":"/2015-03-31/functions/{FunctionName}/versions/HEAD/configuration","responseCode":200},"input":{"type":"structure","required":["FunctionName"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"}}},"output":{"shape":"St"}},"GetPolicy":{"http":{"method":"GET","requestUri":"/2015-03-31/functions/{FunctionName}/versions/HEAD/policy","responseCode":200},"input":{"type":"structure","required":["FunctionName"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"}}},"output":{"type":"structure","members":{"Policy":{}}}},"Invoke":{"http":{"requestUri":"/2015-03-31/functions/{FunctionName}/invocations"},"input":{"type":"structure","required":["FunctionName"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"},"InvocationType":{"location":"header","locationName":"X-Amz-Invocation-Type"},"LogType":{"location":"header","locationName":"X-Amz-Log-Type"},"ClientContext":{"location":"header","locationName":"X-Amz-Client-Context"},"Payload":{"type":"blob"}},"payload":"Payload"},"output":{"type":"structure","members":{"StatusCode":{"location":"statusCode","type":"integer"},"FunctionError":{"location":"header","locationName":"X-Amz-Function-Error"},"LogResult":{"location":"header","locationName":"X-Amz-Log-Result"},"Payload":{"type":"blob"}},"payload":"Payload"}},"InvokeAsync":{"http":{"requestUri":"/2014-11-13/functions/{FunctionName}/invoke-async/","responseCode":202},"input":{"deprecated":true,"type":"structure","required":["FunctionName","InvokeArgs"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"},"InvokeArgs":{"type":"blob","streaming":true}},"payload":"InvokeArgs"},"output":{"deprecated":true,"type":"structure","members":{"Status":{"location":"statusCode","type":"integer"}}},"deprecated":true},"ListEventSourceMappings":{"http":{"method":"GET","requestUri":"/2015-03-31/event-source-mappings/","responseCode":200},"input":{"type":"structure","members":{"EventSourceArn":{"location":"querystring","locationName":"EventSourceArn"},"FunctionName":{"location":"querystring","locationName":"FunctionName"},"Marker":{"location":"querystring","locationName":"Marker"},"MaxItems":{"location":"querystring","locationName":"MaxItems","type":"integer"}}},"output":{"type":"structure","members":{"NextMarker":{},"EventSourceMappings":{"type":"list","member":{"shape":"Se"}}}}},"ListFunctions":{"http":{"method":"GET","requestUri":"/2015-03-31/functions/","responseCode":200},"input":{"type":"structure","members":{"Marker":{"location":"querystring","locationName":"Marker"},"MaxItems":{"location":"querystring","locationName":"MaxItems","type":"integer"}}},"output":{"type":"structure","members":{"NextMarker":{},"Functions":{"type":"list","member":{"shape":"St"}}}}},"RemovePermission":{"http":{"method":"DELETE","requestUri":"/2015-03-31/functions/{FunctionName}/versions/HEAD/policy/{StatementId}","responseCode":204},"input":{"type":"structure","required":["FunctionName","StatementId"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"},"StatementId":{"location":"uri","locationName":"StatementId"}}}},"UpdateEventSourceMapping":{"http":{"method":"PUT","requestUri":"/2015-03-31/event-source-mappings/{UUID}","responseCode":202},"input":{"type":"structure","required":["UUID"],"members":{"UUID":{"location":"uri","locationName":"UUID"},"FunctionName":{},"Enabled":{"type":"boolean"},"BatchSize":{"type":"integer"}}},"output":{"shape":"Se"}},"UpdateFunctionCode":{"http":{"method":"PUT","requestUri":"/2015-03-31/functions/{FunctionName}/versions/HEAD/code","responseCode":200},"input":{"type":"structure","required":["FunctionName"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"},"ZipFile":{"type":"blob"},"S3Bucket":{},"S3Key":{},"S3ObjectVersion":{}}},"output":{"shape":"St"}},"UpdateFunctionConfiguration":{"http":{"method":"PUT","requestUri":"/2015-03-31/functions/{FunctionName}/versions/HEAD/configuration","responseCode":200},"input":{"type":"structure","required":["FunctionName"],"members":{"FunctionName":{"location":"uri","locationName":"FunctionName"},"Role":{},"Handler":{},"Description":{},"Timeout":{"type":"integer"},"MemorySize":{"type":"integer"}}},"output":{"shape":"St"}}},"shapes":{"Se":{"type":"structure","members":{"UUID":{},"BatchSize":{"type":"integer"},"EventSourceArn":{},"FunctionArn":{},"LastModified":{"type":"timestamp"},"LastProcessingResult":{},"State":{},"StateTransitionReason":{}}},"St":{"type":"structure","members":{"FunctionName":{},"FunctionArn":{},"Runtime":{},"Role":{},"Handler":{},"CodeSize":{"type":"long"},"Description":{},"Timeout":{"type":"integer"},"MemorySize":{"type":"integer"},"LastModified":{}}}},"paginators":{"ListEventSourceMappings":{"input_token":"Marker","output_token":"NextMarker","limit_key":"MaxItems","result_key":"EventSourceMappings"},"ListFunctions":{"input_token":"Marker","output_token":"NextMarker","limit_key":"MaxItems","result_key":"Functions"}}};
AWS.apiLoader.services['machinelearning'] = {};
AWS.MachineLearning = AWS.Service.defineService('machinelearning', [ '2014-12-12' ]);
require('./services/machinelearning');

AWS.apiLoader.services['machinelearning']['2014-12-12'] = {"version":"2.0","metadata":{"apiVersion":"2014-12-12","endpointPrefix":"machinelearning","jsonVersion":"1.1","serviceFullName":"Amazon Machine Learning","signatureVersion":"v4","targetPrefix":"AmazonML_20141212","protocol":"json"},"operations":{"CreateBatchPrediction":{"input":{"type":"structure","required":["BatchPredictionId","MLModelId","BatchPredictionDataSourceId","OutputUri"],"members":{"BatchPredictionId":{},"BatchPredictionName":{},"MLModelId":{},"BatchPredictionDataSourceId":{},"OutputUri":{}}},"output":{"type":"structure","members":{"BatchPredictionId":{}}},"http":{}},"CreateDataSourceFromRDS":{"input":{"type":"structure","required":["DataSourceId","RDSData","RoleARN"],"members":{"DataSourceId":{},"DataSourceName":{},"RDSData":{"type":"structure","required":["DatabaseInformation","SelectSqlQuery","DatabaseCredentials","S3StagingLocation","ResourceRole","ServiceRole","SubnetId","SecurityGroupIds"],"members":{"DatabaseInformation":{"shape":"S8"},"SelectSqlQuery":{},"DatabaseCredentials":{"type":"structure","required":["Username","Password"],"members":{"Username":{},"Password":{}}},"S3StagingLocation":{},"DataRearrangement":{},"DataSchema":{},"DataSchemaUri":{},"ResourceRole":{},"ServiceRole":{},"SubnetId":{},"SecurityGroupIds":{"type":"list","member":{}}}},"RoleARN":{},"ComputeStatistics":{"type":"boolean"}}},"output":{"type":"structure","members":{"DataSourceId":{}}},"http":{}},"CreateDataSourceFromRedshift":{"input":{"type":"structure","required":["DataSourceId","DataSpec","RoleARN"],"members":{"DataSourceId":{},"DataSourceName":{},"DataSpec":{"type":"structure","required":["DatabaseInformation","SelectSqlQuery","DatabaseCredentials","S3StagingLocation"],"members":{"DatabaseInformation":{"shape":"Sr"},"SelectSqlQuery":{},"DatabaseCredentials":{"type":"structure","required":["Username","Password"],"members":{"Username":{},"Password":{}}},"S3StagingLocation":{},"DataRearrangement":{},"DataSchema":{},"DataSchemaUri":{}}},"RoleARN":{},"ComputeStatistics":{"type":"boolean"}}},"output":{"type":"structure","members":{"DataSourceId":{}}},"http":{}},"CreateDataSourceFromS3":{"input":{"type":"structure","required":["DataSourceId","DataSpec"],"members":{"DataSourceId":{},"DataSourceName":{},"DataSpec":{"type":"structure","required":["DataLocationS3"],"members":{"DataLocationS3":{},"DataRearrangement":{},"DataSchema":{},"DataSchemaLocationS3":{}}},"ComputeStatistics":{"type":"boolean"}}},"output":{"type":"structure","members":{"DataSourceId":{}}},"http":{}},"CreateEvaluation":{"input":{"type":"structure","required":["EvaluationId","MLModelId","EvaluationDataSourceId"],"members":{"EvaluationId":{},"EvaluationName":{},"MLModelId":{},"EvaluationDataSourceId":{}}},"output":{"type":"structure","members":{"EvaluationId":{}}},"http":{}},"CreateMLModel":{"input":{"type":"structure","required":["MLModelId","MLModelType","TrainingDataSourceId"],"members":{"MLModelId":{},"MLModelName":{},"MLModelType":{},"Parameters":{"shape":"S16"},"TrainingDataSourceId":{},"Recipe":{},"RecipeUri":{}}},"output":{"type":"structure","members":{"MLModelId":{}}},"http":{}},"CreateRealtimeEndpoint":{"input":{"type":"structure","required":["MLModelId"],"members":{"MLModelId":{}}},"output":{"type":"structure","members":{"MLModelId":{},"RealtimeEndpointInfo":{"shape":"S1c"}}},"http":{}},"DeleteBatchPrediction":{"input":{"type":"structure","required":["BatchPredictionId"],"members":{"BatchPredictionId":{}}},"output":{"type":"structure","members":{"BatchPredictionId":{}}},"http":{}},"DeleteDataSource":{"input":{"type":"structure","required":["DataSourceId"],"members":{"DataSourceId":{}}},"output":{"type":"structure","members":{"DataSourceId":{}}},"http":{}},"DeleteEvaluation":{"input":{"type":"structure","required":["EvaluationId"],"members":{"EvaluationId":{}}},"output":{"type":"structure","members":{"EvaluationId":{}}},"http":{}},"DeleteMLModel":{"input":{"type":"structure","required":["MLModelId"],"members":{"MLModelId":{}}},"output":{"type":"structure","members":{"MLModelId":{}}},"http":{}},"DeleteRealtimeEndpoint":{"input":{"type":"structure","required":["MLModelId"],"members":{"MLModelId":{}}},"output":{"type":"structure","members":{"MLModelId":{},"RealtimeEndpointInfo":{"shape":"S1c"}}},"http":{}},"DescribeBatchPredictions":{"input":{"type":"structure","members":{"FilterVariable":{},"EQ":{},"GT":{},"LT":{},"GE":{},"LE":{},"NE":{},"Prefix":{},"SortOrder":{},"NextToken":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","members":{"Results":{"type":"list","member":{"type":"structure","members":{"BatchPredictionId":{},"MLModelId":{},"BatchPredictionDataSourceId":{},"InputDataLocationS3":{},"CreatedByIamUser":{},"CreatedAt":{"type":"timestamp"},"LastUpdatedAt":{"type":"timestamp"},"Name":{},"Status":{},"OutputUri":{},"Message":{}}}},"NextToken":{}}},"http":{}},"DescribeDataSources":{"input":{"type":"structure","members":{"FilterVariable":{},"EQ":{},"GT":{},"LT":{},"GE":{},"LE":{},"NE":{},"Prefix":{},"SortOrder":{},"NextToken":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","members":{"Results":{"type":"list","member":{"type":"structure","members":{"DataSourceId":{},"DataLocationS3":{},"DataRearrangement":{},"CreatedByIamUser":{},"CreatedAt":{"type":"timestamp"},"LastUpdatedAt":{"type":"timestamp"},"DataSizeInBytes":{"type":"long"},"NumberOfFiles":{"type":"long"},"Name":{},"Status":{},"Message":{},"RedshiftMetadata":{"shape":"S28"},"RDSMetadata":{"shape":"S29"},"RoleARN":{},"ComputeStatistics":{"type":"boolean"}}}},"NextToken":{}}},"http":{}},"DescribeEvaluations":{"input":{"type":"structure","members":{"FilterVariable":{},"EQ":{},"GT":{},"LT":{},"GE":{},"LE":{},"NE":{},"Prefix":{},"SortOrder":{},"NextToken":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","members":{"Results":{"type":"list","member":{"type":"structure","members":{"EvaluationId":{},"MLModelId":{},"EvaluationDataSourceId":{},"InputDataLocationS3":{},"CreatedByIamUser":{},"CreatedAt":{"type":"timestamp"},"LastUpdatedAt":{"type":"timestamp"},"Name":{},"Status":{},"PerformanceMetrics":{"shape":"S2g"},"Message":{}}}},"NextToken":{}}},"http":{}},"DescribeMLModels":{"input":{"type":"structure","members":{"FilterVariable":{},"EQ":{},"GT":{},"LT":{},"GE":{},"LE":{},"NE":{},"Prefix":{},"SortOrder":{},"NextToken":{},"Limit":{"type":"integer"}}},"output":{"type":"structure","members":{"Results":{"type":"list","member":{"type":"structure","members":{"MLModelId":{},"TrainingDataSourceId":{},"CreatedByIamUser":{},"CreatedAt":{"type":"timestamp"},"LastUpdatedAt":{"type":"timestamp"},"Name":{},"Status":{},"SizeInBytes":{"type":"long"},"EndpointInfo":{"shape":"S1c"},"TrainingParameters":{"shape":"S16"},"InputDataLocationS3":{},"Algorithm":{},"MLModelType":{},"ScoreThreshold":{"type":"float"},"ScoreThresholdLastUpdatedAt":{"type":"timestamp"},"Message":{}}}},"NextToken":{}}},"http":{}},"GetBatchPrediction":{"input":{"type":"structure","required":["BatchPredictionId"],"members":{"BatchPredictionId":{}}},"output":{"type":"structure","members":{"BatchPredictionId":{},"MLModelId":{},"BatchPredictionDataSourceId":{},"InputDataLocationS3":{},"CreatedByIamUser":{},"CreatedAt":{"type":"timestamp"},"LastUpdatedAt":{"type":"timestamp"},"Name":{},"Status":{},"OutputUri":{},"LogUri":{},"Message":{}}},"http":{}},"GetDataSource":{"input":{"type":"structure","required":["DataSourceId"],"members":{"DataSourceId":{},"Verbose":{"type":"boolean"}}},"output":{"type":"structure","members":{"DataSourceId":{},"DataLocationS3":{},"DataRearrangement":{},"CreatedByIamUser":{},"CreatedAt":{"type":"timestamp"},"LastUpdatedAt":{"type":"timestamp"},"DataSizeInBytes":{"type":"long"},"NumberOfFiles":{"type":"long"},"Name":{},"Status":{},"LogUri":{},"Message":{},"RedshiftMetadata":{"shape":"S28"},"RDSMetadata":{"shape":"S29"},"RoleARN":{},"ComputeStatistics":{"type":"boolean"},"DataSourceSchema":{}}},"http":{}},"GetEvaluation":{"input":{"type":"structure","required":["EvaluationId"],"members":{"EvaluationId":{}}},"output":{"type":"structure","members":{"EvaluationId":{},"MLModelId":{},"EvaluationDataSourceId":{},"InputDataLocationS3":{},"CreatedByIamUser":{},"CreatedAt":{"type":"timestamp"},"LastUpdatedAt":{"type":"timestamp"},"Name":{},"Status":{},"PerformanceMetrics":{"shape":"S2g"},"LogUri":{},"Message":{}}},"http":{}},"GetMLModel":{"input":{"type":"structure","required":["MLModelId"],"members":{"MLModelId":{},"Verbose":{"type":"boolean"}}},"output":{"type":"structure","members":{"MLModelId":{},"TrainingDataSourceId":{},"CreatedByIamUser":{},"CreatedAt":{"type":"timestamp"},"LastUpdatedAt":{"type":"timestamp"},"Name":{},"Status":{},"SizeInBytes":{"type":"long"},"EndpointInfo":{"shape":"S1c"},"TrainingParameters":{"shape":"S16"},"InputDataLocationS3":{},"MLModelType":{},"ScoreThreshold":{"type":"float"},"ScoreThresholdLastUpdatedAt":{"type":"timestamp"},"LogUri":{},"Message":{},"Recipe":{},"Schema":{}}},"http":{}},"Predict":{"input":{"type":"structure","required":["MLModelId","Record","PredictEndpoint"],"members":{"MLModelId":{},"Record":{"type":"map","key":{},"value":{}},"PredictEndpoint":{}}},"output":{"type":"structure","members":{"Prediction":{"type":"structure","members":{"predictedLabel":{},"predictedValue":{"type":"float"},"predictedScores":{"type":"map","key":{},"value":{"type":"float"}},"details":{"type":"map","key":{},"value":{}}}}}},"http":{}},"UpdateBatchPrediction":{"input":{"type":"structure","required":["BatchPredictionId","BatchPredictionName"],"members":{"BatchPredictionId":{},"BatchPredictionName":{}}},"output":{"type":"structure","members":{"BatchPredictionId":{}}},"http":{}},"UpdateDataSource":{"input":{"type":"structure","required":["DataSourceId","DataSourceName"],"members":{"DataSourceId":{},"DataSourceName":{}}},"output":{"type":"structure","members":{"DataSourceId":{}}},"http":{}},"UpdateEvaluation":{"input":{"type":"structure","required":["EvaluationId","EvaluationName"],"members":{"EvaluationId":{},"EvaluationName":{}}},"output":{"type":"structure","members":{"EvaluationId":{}}},"http":{}},"UpdateMLModel":{"input":{"type":"structure","required":["MLModelId"],"members":{"MLModelId":{},"MLModelName":{},"ScoreThreshold":{"type":"float"}}},"output":{"type":"structure","members":{"MLModelId":{}}},"http":{}}},"shapes":{"S8":{"type":"structure","required":["InstanceIdentifier","DatabaseName"],"members":{"InstanceIdentifier":{},"DatabaseName":{}}},"Sr":{"type":"structure","required":["DatabaseName","ClusterIdentifier"],"members":{"DatabaseName":{},"ClusterIdentifier":{}}},"S16":{"type":"map","key":{},"value":{}},"S1c":{"type":"structure","members":{"PeakRequestsPerSecond":{"type":"integer"},"CreatedAt":{"type":"timestamp"},"EndpointUrl":{},"EndpointStatus":{}}},"S28":{"type":"structure","members":{"RedshiftDatabase":{"shape":"Sr"},"DatabaseUserName":{},"SelectSqlQuery":{}}},"S29":{"type":"structure","members":{"Database":{"shape":"S8"},"DatabaseUserName":{},"SelectSqlQuery":{},"ResourceRole":{},"ServiceRole":{},"DataPipelineId":{}}},"S2g":{"type":"structure","members":{"Properties":{"type":"map","key":{},"value":{}}}}},"paginators":{"DescribeBatchPredictions":{"limit_key":"Limit","output_token":"NextToken","input_token":"NextToken","result_key":"Results"},"DescribeDataSources":{"limit_key":"Limit","output_token":"NextToken","input_token":"NextToken","result_key":"Results"},"DescribeEvaluations":{"limit_key":"Limit","output_token":"NextToken","input_token":"NextToken","result_key":"Results"},"DescribeMLModels":{"limit_key":"Limit","output_token":"NextToken","input_token":"NextToken","result_key":"Results"}}};
AWS.apiLoader.services['mobileanalytics'] = {};
AWS.MobileAnalytics = AWS.Service.defineService('mobileanalytics', [ '2014-06-05' ]);

AWS.apiLoader.services['mobileanalytics']['2014-06-05'] = {"version":"2.0","metadata":{"apiVersion":"2014-06-05","endpointPrefix":"mobileanalytics","serviceFullName":"Amazon Mobile Analytics","signatureVersion":"v4","protocol":"rest-json"},"operations":{"PutEvents":{"http":{"requestUri":"/2014-06-05/events","responseCode":202},"input":{"type":"structure","required":["events","clientContext"],"members":{"events":{"type":"list","member":{"type":"structure","required":["eventType","timestamp"],"members":{"eventType":{},"timestamp":{},"session":{"type":"structure","members":{"id":{},"duration":{"type":"long"},"startTimestamp":{},"stopTimestamp":{}}},"version":{},"attributes":{"type":"map","key":{},"value":{}},"metrics":{"type":"map","key":{},"value":{"type":"double"}}}}},"clientContext":{"location":"header","locationName":"x-amz-Client-Context"},"clientContextEncoding":{"location":"header","locationName":"x-amz-Client-Context-Encoding"}}}}},"shapes":{}};
AWS.apiLoader.services['opsworks'] = {};
AWS.OpsWorks = AWS.Service.defineService('opsworks', [ '2013-02-18' ]);

AWS.apiLoader.services['opsworks']['2013-02-18'] = {"version":"2.0","metadata":{"apiVersion":"2013-02-18","endpointPrefix":"opsworks","jsonVersion":"1.1","serviceFullName":"AWS OpsWorks","signatureVersion":"v4","targetPrefix":"OpsWorks_20130218","protocol":"json"},"operations":{"AssignInstance":{"input":{"type":"structure","required":["InstanceId","LayerIds"],"members":{"InstanceId":{},"LayerIds":{"shape":"S3"}}},"http":{}},"AssignVolume":{"input":{"type":"structure","required":["VolumeId"],"members":{"VolumeId":{},"InstanceId":{}}},"http":{}},"AssociateElasticIp":{"input":{"type":"structure","required":["ElasticIp"],"members":{"ElasticIp":{},"InstanceId":{}}},"http":{}},"AttachElasticLoadBalancer":{"input":{"type":"structure","required":["ElasticLoadBalancerName","LayerId"],"members":{"ElasticLoadBalancerName":{},"LayerId":{}}},"http":{}},"CloneStack":{"input":{"type":"structure","required":["SourceStackId","ServiceRoleArn"],"members":{"SourceStackId":{},"Name":{},"Region":{},"VpcId":{},"Attributes":{"shape":"S8"},"ServiceRoleArn":{},"DefaultInstanceProfileArn":{},"DefaultOs":{},"HostnameTheme":{},"DefaultAvailabilityZone":{},"DefaultSubnetId":{},"CustomJson":{},"ConfigurationManager":{"shape":"Sa"},"ChefConfiguration":{"shape":"Sb"},"UseCustomCookbooks":{"type":"boolean"},"UseOpsworksSecurityGroups":{"type":"boolean"},"CustomCookbooksSource":{"shape":"Sd"},"DefaultSshKeyName":{},"ClonePermissions":{"type":"boolean"},"CloneAppIds":{"shape":"S3"},"DefaultRootDeviceType":{},"AgentVersion":{}}},"output":{"type":"structure","members":{"StackId":{}}},"http":{}},"CreateApp":{"input":{"type":"structure","required":["StackId","Name","Type"],"members":{"StackId":{},"Shortname":{},"Name":{},"Description":{},"DataSources":{"shape":"Si"},"Type":{},"AppSource":{"shape":"Sd"},"Domains":{"shape":"S3"},"EnableSsl":{"type":"boolean"},"SslConfiguration":{"shape":"Sl"},"Attributes":{"shape":"Sm"},"Environment":{"shape":"So"}}},"output":{"type":"structure","members":{"AppId":{}}},"http":{}},"CreateDeployment":{"input":{"type":"structure","required":["StackId","Command"],"members":{"StackId":{},"AppId":{},"InstanceIds":{"shape":"S3"},"Command":{"shape":"Ss"},"Comment":{},"CustomJson":{}}},"output":{"type":"structure","members":{"DeploymentId":{}}},"http":{}},"CreateInstance":{"input":{"type":"structure","required":["StackId","LayerIds","InstanceType"],"members":{"StackId":{},"LayerIds":{"shape":"S3"},"InstanceType":{},"AutoScalingType":{},"Hostname":{},"Os":{},"AmiId":{},"SshKeyName":{},"AvailabilityZone":{},"VirtualizationType":{},"SubnetId":{},"Architecture":{},"RootDeviceType":{},"BlockDeviceMappings":{"shape":"Sz"},"InstallUpdatesOnBoot":{"type":"boolean"},"EbsOptimized":{"type":"boolean"},"AgentVersion":{}}},"output":{"type":"structure","members":{"InstanceId":{}}},"http":{}},"CreateLayer":{"input":{"type":"structure","required":["StackId","Type","Name","Shortname"],"members":{"StackId":{},"Type":{},"Name":{},"Shortname":{},"Attributes":{"shape":"S17"},"CustomInstanceProfileArn":{},"CustomJson":{},"CustomSecurityGroupIds":{"shape":"S3"},"Packages":{"shape":"S3"},"VolumeConfigurations":{"shape":"S19"},"EnableAutoHealing":{"type":"boolean"},"AutoAssignElasticIps":{"type":"boolean"},"AutoAssignPublicIps":{"type":"boolean"},"CustomRecipes":{"shape":"S1b"},"InstallUpdatesOnBoot":{"type":"boolean"},"UseEbsOptimizedInstances":{"type":"boolean"},"LifecycleEventConfiguration":{"shape":"S1c"}}},"output":{"type":"structure","members":{"LayerId":{}}},"http":{}},"CreateStack":{"input":{"type":"structure","required":["Name","Region","ServiceRoleArn","DefaultInstanceProfileArn"],"members":{"Name":{},"Region":{},"VpcId":{},"Attributes":{"shape":"S8"},"ServiceRoleArn":{},"DefaultInstanceProfileArn":{},"DefaultOs":{},"HostnameTheme":{},"DefaultAvailabilityZone":{},"DefaultSubnetId":{},"CustomJson":{},"ConfigurationManager":{"shape":"Sa"},"ChefConfiguration":{"shape":"Sb"},"UseCustomCookbooks":{"type":"boolean"},"UseOpsworksSecurityGroups":{"type":"boolean"},"CustomCookbooksSource":{"shape":"Sd"},"DefaultSshKeyName":{},"DefaultRootDeviceType":{},"AgentVersion":{}}},"output":{"type":"structure","members":{"StackId":{}}},"http":{}},"CreateUserProfile":{"input":{"type":"structure","required":["IamUserArn"],"members":{"IamUserArn":{},"SshUsername":{},"SshPublicKey":{},"AllowSelfManagement":{"type":"boolean"}}},"output":{"type":"structure","members":{"IamUserArn":{}}},"http":{}},"DeleteApp":{"input":{"type":"structure","required":["AppId"],"members":{"AppId":{}}},"http":{}},"DeleteInstance":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{},"DeleteElasticIp":{"type":"boolean"},"DeleteVolumes":{"type":"boolean"}}},"http":{}},"DeleteLayer":{"input":{"type":"structure","required":["LayerId"],"members":{"LayerId":{}}},"http":{}},"DeleteStack":{"input":{"type":"structure","required":["StackId"],"members":{"StackId":{}}},"http":{}},"DeleteUserProfile":{"input":{"type":"structure","required":["IamUserArn"],"members":{"IamUserArn":{}}},"http":{}},"DeregisterEcsCluster":{"input":{"type":"structure","required":["EcsClusterArn"],"members":{"EcsClusterArn":{}}},"http":{}},"DeregisterElasticIp":{"input":{"type":"structure","required":["ElasticIp"],"members":{"ElasticIp":{}}},"http":{}},"DeregisterInstance":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{}}},"http":{}},"DeregisterRdsDbInstance":{"input":{"type":"structure","required":["RdsDbInstanceArn"],"members":{"RdsDbInstanceArn":{}}},"http":{}},"DeregisterVolume":{"input":{"type":"structure","required":["VolumeId"],"members":{"VolumeId":{}}},"http":{}},"DescribeAgentVersions":{"input":{"type":"structure","members":{"StackId":{},"ConfigurationManager":{"shape":"Sa"}}},"output":{"type":"structure","members":{"AgentVersions":{"type":"list","member":{"type":"structure","members":{"Version":{},"ConfigurationManager":{"shape":"Sa"}}}}}},"http":{}},"DescribeApps":{"input":{"type":"structure","members":{"StackId":{},"AppIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"Apps":{"type":"list","member":{"type":"structure","members":{"AppId":{},"StackId":{},"Shortname":{},"Name":{},"Description":{},"DataSources":{"shape":"Si"},"Type":{},"AppSource":{"shape":"Sd"},"Domains":{"shape":"S3"},"EnableSsl":{"type":"boolean"},"SslConfiguration":{"shape":"Sl"},"Attributes":{"shape":"Sm"},"CreatedAt":{},"Environment":{"shape":"So"}}}}}},"http":{}},"DescribeCommands":{"input":{"type":"structure","members":{"DeploymentId":{},"InstanceId":{},"CommandIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"Commands":{"type":"list","member":{"type":"structure","members":{"CommandId":{},"InstanceId":{},"DeploymentId":{},"CreatedAt":{},"AcknowledgedAt":{},"CompletedAt":{},"Status":{},"ExitCode":{"type":"integer"},"LogUrl":{},"Type":{}}}}}},"http":{}},"DescribeDeployments":{"input":{"type":"structure","members":{"StackId":{},"AppId":{},"DeploymentIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"Deployments":{"type":"list","member":{"type":"structure","members":{"DeploymentId":{},"StackId":{},"AppId":{},"CreatedAt":{},"CompletedAt":{},"Duration":{"type":"integer"},"IamUserArn":{},"Comment":{},"Command":{"shape":"Ss"},"Status":{},"CustomJson":{},"InstanceIds":{"shape":"S3"}}}}}},"http":{}},"DescribeEcsClusters":{"input":{"type":"structure","members":{"EcsClusterArns":{"shape":"S3"},"StackId":{},"NextToken":{},"MaxResults":{"type":"integer"}}},"output":{"type":"structure","members":{"EcsClusters":{"type":"list","member":{"type":"structure","members":{"EcsClusterArn":{},"EcsClusterName":{},"StackId":{},"RegisteredAt":{}}}},"NextToken":{}}},"http":{}},"DescribeElasticIps":{"input":{"type":"structure","members":{"InstanceId":{},"StackId":{},"Ips":{"shape":"S3"}}},"output":{"type":"structure","members":{"ElasticIps":{"type":"list","member":{"type":"structure","members":{"Ip":{},"Name":{},"Domain":{},"Region":{},"InstanceId":{}}}}}},"http":{}},"DescribeElasticLoadBalancers":{"input":{"type":"structure","members":{"StackId":{},"LayerIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"ElasticLoadBalancers":{"type":"list","member":{"type":"structure","members":{"ElasticLoadBalancerName":{},"Region":{},"DnsName":{},"StackId":{},"LayerId":{},"VpcId":{},"AvailabilityZones":{"shape":"S3"},"SubnetIds":{"shape":"S3"},"Ec2InstanceIds":{"shape":"S3"}}}}}},"http":{}},"DescribeInstances":{"input":{"type":"structure","members":{"StackId":{},"LayerId":{},"InstanceIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"Instances":{"type":"list","member":{"type":"structure","members":{"AgentVersion":{},"AmiId":{},"Architecture":{},"AutoScalingType":{},"AvailabilityZone":{},"BlockDeviceMappings":{"shape":"Sz"},"CreatedAt":{},"EbsOptimized":{"type":"boolean"},"Ec2InstanceId":{},"EcsClusterArn":{},"EcsContainerInstanceArn":{},"ElasticIp":{},"Hostname":{},"InfrastructureClass":{},"InstallUpdatesOnBoot":{"type":"boolean"},"InstanceId":{},"InstanceProfileArn":{},"InstanceType":{},"LastServiceErrorId":{},"LayerIds":{"shape":"S3"},"Os":{},"Platform":{},"PrivateDns":{},"PrivateIp":{},"PublicDns":{},"PublicIp":{},"RegisteredBy":{},"ReportedAgentVersion":{},"ReportedOs":{"type":"structure","members":{"Family":{},"Name":{},"Version":{}}},"RootDeviceType":{},"RootDeviceVolumeId":{},"SecurityGroupIds":{"shape":"S3"},"SshHostDsaKeyFingerprint":{},"SshHostRsaKeyFingerprint":{},"SshKeyName":{},"StackId":{},"Status":{},"SubnetId":{},"VirtualizationType":{}}}}}},"http":{}},"DescribeLayers":{"input":{"type":"structure","members":{"StackId":{},"LayerIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"Layers":{"type":"list","member":{"type":"structure","members":{"StackId":{},"LayerId":{},"Type":{},"Name":{},"Shortname":{},"Attributes":{"shape":"S17"},"CustomInstanceProfileArn":{},"CustomJson":{},"CustomSecurityGroupIds":{"shape":"S3"},"DefaultSecurityGroupNames":{"shape":"S3"},"Packages":{"shape":"S3"},"VolumeConfigurations":{"shape":"S19"},"EnableAutoHealing":{"type":"boolean"},"AutoAssignElasticIps":{"type":"boolean"},"AutoAssignPublicIps":{"type":"boolean"},"DefaultRecipes":{"shape":"S1b"},"CustomRecipes":{"shape":"S1b"},"CreatedAt":{},"InstallUpdatesOnBoot":{"type":"boolean"},"UseEbsOptimizedInstances":{"type":"boolean"},"LifecycleEventConfiguration":{"shape":"S1c"}}}}}},"http":{}},"DescribeLoadBasedAutoScaling":{"input":{"type":"structure","required":["LayerIds"],"members":{"LayerIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"LoadBasedAutoScalingConfigurations":{"type":"list","member":{"type":"structure","members":{"LayerId":{},"Enable":{"type":"boolean"},"UpScaling":{"shape":"S30"},"DownScaling":{"shape":"S30"}}}}}},"http":{}},"DescribeMyUserProfile":{"output":{"type":"structure","members":{"UserProfile":{"type":"structure","members":{"IamUserArn":{},"Name":{},"SshUsername":{},"SshPublicKey":{}}}}},"http":{}},"DescribePermissions":{"input":{"type":"structure","members":{"IamUserArn":{},"StackId":{}}},"output":{"type":"structure","members":{"Permissions":{"type":"list","member":{"type":"structure","members":{"StackId":{},"IamUserArn":{},"AllowSsh":{"type":"boolean"},"AllowSudo":{"type":"boolean"},"Level":{}}}}}},"http":{}},"DescribeRaidArrays":{"input":{"type":"structure","members":{"InstanceId":{},"StackId":{},"RaidArrayIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"RaidArrays":{"type":"list","member":{"type":"structure","members":{"RaidArrayId":{},"InstanceId":{},"Name":{},"RaidLevel":{"type":"integer"},"NumberOfDisks":{"type":"integer"},"Size":{"type":"integer"},"Device":{},"MountPoint":{},"AvailabilityZone":{},"CreatedAt":{},"StackId":{},"VolumeType":{},"Iops":{"type":"integer"}}}}}},"http":{}},"DescribeRdsDbInstances":{"input":{"type":"structure","required":["StackId"],"members":{"StackId":{},"RdsDbInstanceArns":{"shape":"S3"}}},"output":{"type":"structure","members":{"RdsDbInstances":{"type":"list","member":{"type":"structure","members":{"RdsDbInstanceArn":{},"DbInstanceIdentifier":{},"DbUser":{},"DbPassword":{},"Region":{},"Address":{},"Engine":{},"StackId":{},"MissingOnRds":{"type":"boolean"}}}}}},"http":{}},"DescribeServiceErrors":{"input":{"type":"structure","members":{"StackId":{},"InstanceId":{},"ServiceErrorIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"ServiceErrors":{"type":"list","member":{"type":"structure","members":{"ServiceErrorId":{},"StackId":{},"InstanceId":{},"Type":{},"Message":{},"CreatedAt":{}}}}}},"http":{}},"DescribeStackProvisioningParameters":{"input":{"type":"structure","required":["StackId"],"members":{"StackId":{}}},"output":{"type":"structure","members":{"AgentInstallerUrl":{},"Parameters":{"type":"map","key":{},"value":{}}}},"http":{}},"DescribeStackSummary":{"input":{"type":"structure","required":["StackId"],"members":{"StackId":{}}},"output":{"type":"structure","members":{"StackSummary":{"type":"structure","members":{"StackId":{},"Name":{},"Arn":{},"LayersCount":{"type":"integer"},"AppsCount":{"type":"integer"},"InstancesCount":{"type":"structure","members":{"Assigning":{"type":"integer"},"Booting":{"type":"integer"},"ConnectionLost":{"type":"integer"},"Deregistering":{"type":"integer"},"Online":{"type":"integer"},"Pending":{"type":"integer"},"Rebooting":{"type":"integer"},"Registered":{"type":"integer"},"Registering":{"type":"integer"},"Requested":{"type":"integer"},"RunningSetup":{"type":"integer"},"SetupFailed":{"type":"integer"},"ShuttingDown":{"type":"integer"},"StartFailed":{"type":"integer"},"Stopped":{"type":"integer"},"Stopping":{"type":"integer"},"Terminated":{"type":"integer"},"Terminating":{"type":"integer"},"Unassigning":{"type":"integer"}}}}}}},"http":{}},"DescribeStacks":{"input":{"type":"structure","members":{"StackIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"Stacks":{"type":"list","member":{"type":"structure","members":{"StackId":{},"Name":{},"Arn":{},"Region":{},"VpcId":{},"Attributes":{"shape":"S8"},"ServiceRoleArn":{},"DefaultInstanceProfileArn":{},"DefaultOs":{},"HostnameTheme":{},"DefaultAvailabilityZone":{},"DefaultSubnetId":{},"CustomJson":{},"ConfigurationManager":{"shape":"Sa"},"ChefConfiguration":{"shape":"Sb"},"UseCustomCookbooks":{"type":"boolean"},"UseOpsworksSecurityGroups":{"type":"boolean"},"CustomCookbooksSource":{"shape":"Sd"},"DefaultSshKeyName":{},"CreatedAt":{},"DefaultRootDeviceType":{},"AgentVersion":{}}}}}},"http":{}},"DescribeTimeBasedAutoScaling":{"input":{"type":"structure","required":["InstanceIds"],"members":{"InstanceIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"TimeBasedAutoScalingConfigurations":{"type":"list","member":{"type":"structure","members":{"InstanceId":{},"AutoScalingSchedule":{"shape":"S40"}}}}}},"http":{}},"DescribeUserProfiles":{"input":{"type":"structure","members":{"IamUserArns":{"shape":"S3"}}},"output":{"type":"structure","members":{"UserProfiles":{"type":"list","member":{"type":"structure","members":{"IamUserArn":{},"Name":{},"SshUsername":{},"SshPublicKey":{},"AllowSelfManagement":{"type":"boolean"}}}}}},"http":{}},"DescribeVolumes":{"input":{"type":"structure","members":{"InstanceId":{},"StackId":{},"RaidArrayId":{},"VolumeIds":{"shape":"S3"}}},"output":{"type":"structure","members":{"Volumes":{"type":"list","member":{"type":"structure","members":{"VolumeId":{},"Ec2VolumeId":{},"Name":{},"RaidArrayId":{},"InstanceId":{},"Status":{},"Size":{"type":"integer"},"Device":{},"MountPoint":{},"Region":{},"AvailabilityZone":{},"VolumeType":{},"Iops":{"type":"integer"}}}}}},"http":{}},"DetachElasticLoadBalancer":{"input":{"type":"structure","required":["ElasticLoadBalancerName","LayerId"],"members":{"ElasticLoadBalancerName":{},"LayerId":{}}},"http":{}},"DisassociateElasticIp":{"input":{"type":"structure","required":["ElasticIp"],"members":{"ElasticIp":{}}},"http":{}},"GetHostnameSuggestion":{"input":{"type":"structure","required":["LayerId"],"members":{"LayerId":{}}},"output":{"type":"structure","members":{"LayerId":{},"Hostname":{}}},"http":{}},"GrantAccess":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{},"ValidForInMinutes":{"type":"integer"}}},"output":{"type":"structure","members":{"TemporaryCredential":{"type":"structure","members":{"Username":{},"Password":{},"ValidForInMinutes":{"type":"integer"},"InstanceId":{}}}}},"http":{}},"RebootInstance":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{}}},"http":{}},"RegisterEcsCluster":{"input":{"type":"structure","required":["EcsClusterArn","StackId"],"members":{"EcsClusterArn":{},"StackId":{}}},"output":{"type":"structure","members":{"EcsClusterArn":{}}},"http":{}},"RegisterElasticIp":{"input":{"type":"structure","required":["ElasticIp","StackId"],"members":{"ElasticIp":{},"StackId":{}}},"output":{"type":"structure","members":{"ElasticIp":{}}},"http":{}},"RegisterInstance":{"input":{"type":"structure","required":["StackId"],"members":{"StackId":{},"Hostname":{},"PublicIp":{},"PrivateIp":{},"RsaPublicKey":{},"RsaPublicKeyFingerprint":{},"InstanceIdentity":{"type":"structure","members":{"Document":{},"Signature":{}}}}},"output":{"type":"structure","members":{"InstanceId":{}}},"http":{}},"RegisterRdsDbInstance":{"input":{"type":"structure","required":["StackId","RdsDbInstanceArn","DbUser","DbPassword"],"members":{"StackId":{},"RdsDbInstanceArn":{},"DbUser":{},"DbPassword":{}}},"http":{}},"RegisterVolume":{"input":{"type":"structure","required":["StackId"],"members":{"Ec2VolumeId":{},"StackId":{}}},"output":{"type":"structure","members":{"VolumeId":{}}},"http":{}},"SetLoadBasedAutoScaling":{"input":{"type":"structure","required":["LayerId"],"members":{"LayerId":{},"Enable":{"type":"boolean"},"UpScaling":{"shape":"S30"},"DownScaling":{"shape":"S30"}}},"http":{}},"SetPermission":{"input":{"type":"structure","required":["StackId","IamUserArn"],"members":{"StackId":{},"IamUserArn":{},"AllowSsh":{"type":"boolean"},"AllowSudo":{"type":"boolean"},"Level":{}}},"http":{}},"SetTimeBasedAutoScaling":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{},"AutoScalingSchedule":{"shape":"S40"}}},"http":{}},"StartInstance":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{}}},"http":{}},"StartStack":{"input":{"type":"structure","required":["StackId"],"members":{"StackId":{}}},"http":{}},"StopInstance":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{}}},"http":{}},"StopStack":{"input":{"type":"structure","required":["StackId"],"members":{"StackId":{}}},"http":{}},"UnassignInstance":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{}}},"http":{}},"UnassignVolume":{"input":{"type":"structure","required":["VolumeId"],"members":{"VolumeId":{}}},"http":{}},"UpdateApp":{"input":{"type":"structure","required":["AppId"],"members":{"AppId":{},"Name":{},"Description":{},"DataSources":{"shape":"Si"},"Type":{},"AppSource":{"shape":"Sd"},"Domains":{"shape":"S3"},"EnableSsl":{"type":"boolean"},"SslConfiguration":{"shape":"Sl"},"Attributes":{"shape":"Sm"},"Environment":{"shape":"So"}}},"http":{}},"UpdateElasticIp":{"input":{"type":"structure","required":["ElasticIp"],"members":{"ElasticIp":{},"Name":{}}},"http":{}},"UpdateInstance":{"input":{"type":"structure","required":["InstanceId"],"members":{"InstanceId":{},"LayerIds":{"shape":"S3"},"InstanceType":{},"AutoScalingType":{},"Hostname":{},"Os":{},"AmiId":{},"SshKeyName":{},"Architecture":{},"InstallUpdatesOnBoot":{"type":"boolean"},"EbsOptimized":{"type":"boolean"},"AgentVersion":{}}},"http":{}},"UpdateLayer":{"input":{"type":"structure","required":["LayerId"],"members":{"LayerId":{},"Name":{},"Shortname":{},"Attributes":{"shape":"S17"},"CustomInstanceProfileArn":{},"CustomJson":{},"CustomSecurityGroupIds":{"shape":"S3"},"Packages":{"shape":"S3"},"VolumeConfigurations":{"shape":"S19"},"EnableAutoHealing":{"type":"boolean"},"AutoAssignElasticIps":{"type":"boolean"},"AutoAssignPublicIps":{"type":"boolean"},"CustomRecipes":{"shape":"S1b"},"InstallUpdatesOnBoot":{"type":"boolean"},"UseEbsOptimizedInstances":{"type":"boolean"},"LifecycleEventConfiguration":{"shape":"S1c"}}},"http":{}},"UpdateMyUserProfile":{"input":{"type":"structure","members":{"SshPublicKey":{}}},"http":{}},"UpdateRdsDbInstance":{"input":{"type":"structure","required":["RdsDbInstanceArn"],"members":{"RdsDbInstanceArn":{},"DbUser":{},"DbPassword":{}}},"http":{}},"UpdateStack":{"input":{"type":"structure","required":["StackId"],"members":{"StackId":{},"Name":{},"Attributes":{"shape":"S8"},"ServiceRoleArn":{},"DefaultInstanceProfileArn":{},"DefaultOs":{},"HostnameTheme":{},"DefaultAvailabilityZone":{},"DefaultSubnetId":{},"CustomJson":{},"ConfigurationManager":{"shape":"Sa"},"ChefConfiguration":{"shape":"Sb"},"UseCustomCookbooks":{"type":"boolean"},"CustomCookbooksSource":{"shape":"Sd"},"DefaultSshKeyName":{},"DefaultRootDeviceType":{},"UseOpsworksSecurityGroups":{"type":"boolean"},"AgentVersion":{}}},"http":{}},"UpdateUserProfile":{"input":{"type":"structure","required":["IamUserArn"],"members":{"IamUserArn":{},"SshUsername":{},"SshPublicKey":{},"AllowSelfManagement":{"type":"boolean"}}},"http":{}},"UpdateVolume":{"input":{"type":"structure","required":["VolumeId"],"members":{"VolumeId":{},"Name":{},"MountPoint":{}}},"http":{}}},"shapes":{"S3":{"type":"list","member":{}},"S8":{"type":"map","key":{},"value":{}},"Sa":{"type":"structure","members":{"Name":{},"Version":{}}},"Sb":{"type":"structure","members":{"ManageBerkshelf":{"type":"boolean"},"BerkshelfVersion":{}}},"Sd":{"type":"structure","members":{"Type":{},"Url":{},"Username":{},"Password":{},"SshKey":{},"Revision":{}}},"Si":{"type":"list","member":{"type":"structure","members":{"Type":{},"Arn":{},"DatabaseName":{}}}},"Sl":{"type":"structure","required":["Certificate","PrivateKey"],"members":{"Certificate":{},"PrivateKey":{},"Chain":{}}},"Sm":{"type":"map","key":{},"value":{}},"So":{"type":"list","member":{"type":"structure","required":["Key","Value"],"members":{"Key":{},"Value":{},"Secure":{"type":"boolean"}}}},"Ss":{"type":"structure","required":["Name"],"members":{"Name":{},"Args":{"type":"map","key":{},"value":{"shape":"S3"}}}},"Sz":{"type":"list","member":{"type":"structure","members":{"DeviceName":{},"NoDevice":{},"VirtualName":{},"Ebs":{"type":"structure","members":{"SnapshotId":{},"Iops":{"type":"integer"},"VolumeSize":{"type":"integer"},"VolumeType":{},"DeleteOnTermination":{"type":"boolean"}}}}}},"S17":{"type":"map","key":{},"value":{}},"S19":{"type":"list","member":{"type":"structure","required":["MountPoint","NumberOfDisks","Size"],"members":{"MountPoint":{},"RaidLevel":{"type":"integer"},"NumberOfDisks":{"type":"integer"},"Size":{"type":"integer"},"VolumeType":{},"Iops":{"type":"integer"}}}},"S1b":{"type":"structure","members":{"Setup":{"shape":"S3"},"Configure":{"shape":"S3"},"Deploy":{"shape":"S3"},"Undeploy":{"shape":"S3"},"Shutdown":{"shape":"S3"}}},"S1c":{"type":"structure","members":{"Shutdown":{"type":"structure","members":{"ExecutionTimeout":{"type":"integer"},"DelayUntilElbConnectionsDrained":{"type":"boolean"}}}}},"S30":{"type":"structure","members":{"InstanceCount":{"type":"integer"},"ThresholdsWaitTime":{"type":"integer"},"IgnoreMetricsTime":{"type":"integer"},"CpuThreshold":{"type":"double"},"MemoryThreshold":{"type":"double"},"LoadThreshold":{"type":"double"},"Alarms":{"shape":"S3"}}},"S40":{"type":"structure","members":{"Monday":{"shape":"S41"},"Tuesday":{"shape":"S41"},"Wednesday":{"shape":"S41"},"Thursday":{"shape":"S41"},"Friday":{"shape":"S41"},"Saturday":{"shape":"S41"},"Sunday":{"shape":"S41"}}},"S41":{"type":"map","key":{},"value":{}}},"examples":{},"paginators":{"DescribeApps":{"result_key":"Apps"},"DescribeCommands":{"result_key":"Commands"},"DescribeDeployments":{"result_key":"Deployments"},"DescribeElasticIps":{"result_key":"ElasticIps"},"DescribeElasticLoadBalancers":{"result_key":"ElasticLoadBalancers"},"DescribeInstances":{"result_key":"Instances"},"DescribeLayers":{"result_key":"Layers"},"DescribeLoadBasedAutoScaling":{"result_key":"LoadBasedAutoScalingConfigurations"},"DescribePermissions":{"result_key":"Permissions"},"DescribeRaidArrays":{"result_key":"RaidArrays"},"DescribeServiceErrors":{"result_key":"ServiceErrors"},"DescribeStacks":{"result_key":"Stacks"},"DescribeTimeBasedAutoScaling":{"result_key":"TimeBasedAutoScalingConfigurations"},"DescribeUserProfiles":{"result_key":"UserProfiles"},"DescribeVolumes":{"result_key":"Volumes"}}};
AWS.apiLoader.services['s3'] = {};
AWS.S3 = AWS.Service.defineService('s3', [ '2006-03-01' ]);
require('./services/s3');

AWS.apiLoader.services['s3']['2006-03-01'] = {"version":"2.0","metadata":{"apiVersion":"2006-03-01","checksumFormat":"md5","endpointPrefix":"s3","globalEndpoint":"s3.amazonaws.com","serviceAbbreviation":"Amazon S3","serviceFullName":"Amazon Simple Storage Service","signatureVersion":"s3","timestampFormat":"rfc822","protocol":"rest-xml"},"operations":{"AbortMultipartUpload":{"http":{"method":"DELETE","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","Key","UploadId"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"UploadId":{"location":"querystring","locationName":"uploadId"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}}},"CompleteMultipartUpload":{"http":{"requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","Key","UploadId"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"MultipartUpload":{"locationName":"CompleteMultipartUpload","xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"type":"structure","members":{"Parts":{"locationName":"Part","type":"list","member":{"type":"structure","members":{"ETag":{},"PartNumber":{"type":"integer"}}},"flattened":true}}},"UploadId":{"location":"querystring","locationName":"uploadId"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}},"payload":"MultipartUpload"},"output":{"type":"structure","members":{"Location":{},"Bucket":{},"Key":{},"Expiration":{"location":"header","locationName":"x-amz-expiration"},"ETag":{},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"VersionId":{"location":"header","locationName":"x-amz-version-id"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}}},"CopyObject":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","CopySource","Key"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"Bucket":{"location":"uri","locationName":"Bucket"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentType":{"location":"header","locationName":"Content-Type"},"CopySource":{"location":"header","locationName":"x-amz-copy-source"},"CopySourceIfMatch":{"location":"header","locationName":"x-amz-copy-source-if-match"},"CopySourceIfModifiedSince":{"location":"header","locationName":"x-amz-copy-source-if-modified-since","type":"timestamp"},"CopySourceIfNoneMatch":{"location":"header","locationName":"x-amz-copy-source-if-none-match"},"CopySourceIfUnmodifiedSince":{"location":"header","locationName":"x-amz-copy-source-if-unmodified-since","type":"timestamp"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"},"Key":{"location":"uri","locationName":"Key"},"Metadata":{"shape":"S11","location":"headers","locationName":"x-amz-meta-"},"MetadataDirective":{"location":"header","locationName":"x-amz-metadata-directive"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"StorageClass":{"location":"header","locationName":"x-amz-storage-class"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"shape":"S18","location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"CopySourceSSECustomerAlgorithm":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-algorithm"},"CopySourceSSECustomerKey":{"shape":"S1b","location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-key"},"CopySourceSSECustomerKeyMD5":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-key-MD5"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"CopyObjectResult":{"type":"structure","members":{"ETag":{},"LastModified":{"type":"timestamp"}}},"Expiration":{"location":"header","locationName":"x-amz-expiration"},"CopySourceVersionId":{"location":"header","locationName":"x-amz-copy-source-version-id"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}},"payload":"CopyObjectResult"},"alias":"PutObjectCopy"},"CreateBucket":{"http":{"method":"PUT","requestUri":"/{Bucket}"},"input":{"type":"structure","required":["Bucket"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"Bucket":{"location":"uri","locationName":"Bucket"},"CreateBucketConfiguration":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"CreateBucketConfiguration","type":"structure","members":{"LocationConstraint":{}}},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWrite":{"location":"header","locationName":"x-amz-grant-write"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"}},"payload":"CreateBucketConfiguration"},"output":{"type":"structure","members":{"Location":{"location":"header","locationName":"Location"}}},"alias":"PutBucket"},"CreateMultipartUpload":{"http":{"requestUri":"/{Bucket}/{Key+}?uploads"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"Bucket":{"location":"uri","locationName":"Bucket"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentType":{"location":"header","locationName":"Content-Type"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"},"Key":{"location":"uri","locationName":"Key"},"Metadata":{"shape":"S11","location":"headers","locationName":"x-amz-meta-"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"StorageClass":{"location":"header","locationName":"x-amz-storage-class"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"shape":"S18","location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"Bucket":{"locationName":"Bucket"},"Key":{},"UploadId":{},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}},"alias":"InitiateMultipartUpload"},"DeleteBucket":{"http":{"method":"DELETE","requestUri":"/{Bucket}"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketCors":{"http":{"method":"DELETE","requestUri":"/{Bucket}?cors"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketLifecycle":{"http":{"method":"DELETE","requestUri":"/{Bucket}?lifecycle"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketPolicy":{"http":{"method":"DELETE","requestUri":"/{Bucket}?policy"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketReplication":{"http":{"method":"DELETE","requestUri":"/{Bucket}?replication"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketTagging":{"http":{"method":"DELETE","requestUri":"/{Bucket}?tagging"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteBucketWebsite":{"http":{"method":"DELETE","requestUri":"/{Bucket}?website"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"DeleteObject":{"http":{"method":"DELETE","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"MFA":{"location":"header","locationName":"x-amz-mfa"},"VersionId":{"location":"querystring","locationName":"versionId"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"DeleteMarker":{"location":"header","locationName":"x-amz-delete-marker","type":"boolean"},"VersionId":{"location":"header","locationName":"x-amz-version-id"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}}},"DeleteObjects":{"http":{"requestUri":"/{Bucket}?delete"},"input":{"type":"structure","required":["Bucket","Delete"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Delete":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"Delete","type":"structure","required":["Objects"],"members":{"Objects":{"locationName":"Object","type":"list","member":{"type":"structure","required":["Key"],"members":{"Key":{},"VersionId":{}}},"flattened":true},"Quiet":{"type":"boolean"}}},"MFA":{"location":"header","locationName":"x-amz-mfa"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}},"payload":"Delete"},"output":{"type":"structure","members":{"Deleted":{"type":"list","member":{"type":"structure","members":{"Key":{},"VersionId":{},"DeleteMarker":{"type":"boolean"},"DeleteMarkerVersionId":{}}},"flattened":true},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"},"Errors":{"locationName":"Error","type":"list","member":{"type":"structure","members":{"Key":{},"VersionId":{},"Code":{},"Message":{}}},"flattened":true}}},"alias":"DeleteMultipleObjects"},"GetBucketAcl":{"http":{"method":"GET","requestUri":"/{Bucket}?acl"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Owner":{"shape":"S2f"},"Grants":{"shape":"S2i","locationName":"AccessControlList"}}}},"GetBucketCors":{"http":{"method":"GET","requestUri":"/{Bucket}?cors"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"CORSRules":{"shape":"S2r","locationName":"CORSRule"}}}},"GetBucketLifecycle":{"http":{"method":"GET","requestUri":"/{Bucket}?lifecycle"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Rules":{"shape":"S34","locationName":"Rule"}}}},"GetBucketLocation":{"http":{"method":"GET","requestUri":"/{Bucket}?location"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"LocationConstraint":{}}}},"GetBucketLogging":{"http":{"method":"GET","requestUri":"/{Bucket}?logging"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"LoggingEnabled":{"shape":"S3j"}}}},"GetBucketNotification":{"http":{"method":"GET","requestUri":"/{Bucket}?notification"},"input":{"shape":"S3p"},"output":{"shape":"S3q"},"deprecated":true},"GetBucketNotificationConfiguration":{"http":{"method":"GET","requestUri":"/{Bucket}?notification"},"input":{"shape":"S3p"},"output":{"shape":"S41"}},"GetBucketPolicy":{"http":{"method":"GET","requestUri":"/{Bucket}?policy"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Policy":{}},"payload":"Policy"}},"GetBucketReplication":{"http":{"method":"GET","requestUri":"/{Bucket}?replication"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"ReplicationConfiguration":{"shape":"S4e"}},"payload":"ReplicationConfiguration"}},"GetBucketRequestPayment":{"http":{"method":"GET","requestUri":"/{Bucket}?requestPayment"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Payer":{}}}},"GetBucketTagging":{"http":{"method":"GET","requestUri":"/{Bucket}?tagging"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","required":["TagSet"],"members":{"TagSet":{"shape":"S4p"}}}},"GetBucketVersioning":{"http":{"method":"GET","requestUri":"/{Bucket}?versioning"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"Status":{},"MFADelete":{"locationName":"MfaDelete"}}}},"GetBucketWebsite":{"http":{"method":"GET","requestUri":"/{Bucket}?website"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"output":{"type":"structure","members":{"RedirectAllRequestsTo":{"shape":"S4y"},"IndexDocument":{"shape":"S51"},"ErrorDocument":{"shape":"S53"},"RoutingRules":{"shape":"S54"}}}},"GetObject":{"http":{"method":"GET","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"IfMatch":{"location":"header","locationName":"If-Match"},"IfModifiedSince":{"location":"header","locationName":"If-Modified-Since","type":"timestamp"},"IfNoneMatch":{"location":"header","locationName":"If-None-Match"},"IfUnmodifiedSince":{"location":"header","locationName":"If-Unmodified-Since","type":"timestamp"},"Key":{"location":"uri","locationName":"Key"},"Range":{"location":"header","locationName":"Range"},"ResponseCacheControl":{"location":"querystring","locationName":"response-cache-control"},"ResponseContentDisposition":{"location":"querystring","locationName":"response-content-disposition"},"ResponseContentEncoding":{"location":"querystring","locationName":"response-content-encoding"},"ResponseContentLanguage":{"location":"querystring","locationName":"response-content-language"},"ResponseContentType":{"location":"querystring","locationName":"response-content-type"},"ResponseExpires":{"location":"querystring","locationName":"response-expires","type":"timestamp"},"VersionId":{"location":"querystring","locationName":"versionId"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"shape":"S18","location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"Body":{"streaming":true,"type":"blob"},"DeleteMarker":{"location":"header","locationName":"x-amz-delete-marker","type":"boolean"},"AcceptRanges":{"location":"header","locationName":"accept-ranges"},"Expiration":{"location":"header","locationName":"x-amz-expiration"},"Restore":{"location":"header","locationName":"x-amz-restore"},"LastModified":{"location":"header","locationName":"Last-Modified","type":"timestamp"},"ContentLength":{"location":"header","locationName":"Content-Length","type":"integer"},"ETag":{"location":"header","locationName":"ETag"},"MissingMeta":{"location":"header","locationName":"x-amz-missing-meta","type":"integer"},"VersionId":{"location":"header","locationName":"x-amz-version-id"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentRange":{"location":"header","locationName":"Content-Range"},"ContentType":{"location":"header","locationName":"Content-Type"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"Metadata":{"shape":"S11","location":"headers","locationName":"x-amz-meta-"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"StorageClass":{"location":"header","locationName":"x-amz-storage-class"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"},"ReplicationStatus":{"location":"header","locationName":"x-amz-replication-status"}},"payload":"Body"}},"GetObjectAcl":{"http":{"method":"GET","requestUri":"/{Bucket}/{Key+}?acl"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"VersionId":{"location":"querystring","locationName":"versionId"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"Owner":{"shape":"S2f"},"Grants":{"shape":"S2i","locationName":"AccessControlList"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}}},"GetObjectTorrent":{"http":{"method":"GET","requestUri":"/{Bucket}/{Key+}?torrent"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"Body":{"streaming":true,"type":"blob"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}},"payload":"Body"}},"HeadBucket":{"http":{"method":"HEAD","requestUri":"/{Bucket}"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}}},"HeadObject":{"http":{"method":"HEAD","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"IfMatch":{"location":"header","locationName":"If-Match"},"IfModifiedSince":{"location":"header","locationName":"If-Modified-Since","type":"timestamp"},"IfNoneMatch":{"location":"header","locationName":"If-None-Match"},"IfUnmodifiedSince":{"location":"header","locationName":"If-Unmodified-Since","type":"timestamp"},"Key":{"location":"uri","locationName":"Key"},"Range":{"location":"header","locationName":"Range"},"VersionId":{"location":"querystring","locationName":"versionId"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"shape":"S18","location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"DeleteMarker":{"location":"header","locationName":"x-amz-delete-marker","type":"boolean"},"AcceptRanges":{"location":"header","locationName":"accept-ranges"},"Expiration":{"location":"header","locationName":"x-amz-expiration"},"Restore":{"location":"header","locationName":"x-amz-restore"},"LastModified":{"location":"header","locationName":"Last-Modified","type":"timestamp"},"ContentLength":{"location":"header","locationName":"Content-Length","type":"integer"},"ETag":{"location":"header","locationName":"ETag"},"MissingMeta":{"location":"header","locationName":"x-amz-missing-meta","type":"integer"},"VersionId":{"location":"header","locationName":"x-amz-version-id"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentType":{"location":"header","locationName":"Content-Type"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"Metadata":{"shape":"S11","location":"headers","locationName":"x-amz-meta-"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"StorageClass":{"location":"header","locationName":"x-amz-storage-class"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"},"ReplicationStatus":{"location":"header","locationName":"x-amz-replication-status"}}}},"ListBuckets":{"http":{"method":"GET"},"output":{"type":"structure","members":{"Buckets":{"type":"list","member":{"locationName":"Bucket","type":"structure","members":{"Name":{},"CreationDate":{"type":"timestamp"}}}},"Owner":{"shape":"S2f"}}},"alias":"GetService"},"ListMultipartUploads":{"http":{"method":"GET","requestUri":"/{Bucket}?uploads"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Delimiter":{"location":"querystring","locationName":"delimiter"},"EncodingType":{"location":"querystring","locationName":"encoding-type"},"KeyMarker":{"location":"querystring","locationName":"key-marker"},"MaxUploads":{"location":"querystring","locationName":"max-uploads","type":"integer"},"Prefix":{"location":"querystring","locationName":"prefix"},"UploadIdMarker":{"location":"querystring","locationName":"upload-id-marker"}}},"output":{"type":"structure","members":{"Bucket":{},"KeyMarker":{},"UploadIdMarker":{},"NextKeyMarker":{},"Prefix":{},"Delimiter":{},"NextUploadIdMarker":{},"MaxUploads":{"type":"integer"},"IsTruncated":{"type":"boolean"},"Uploads":{"locationName":"Upload","type":"list","member":{"type":"structure","members":{"UploadId":{},"Key":{},"Initiated":{"type":"timestamp"},"StorageClass":{},"Owner":{"shape":"S2f"},"Initiator":{"shape":"S6l"}}},"flattened":true},"CommonPrefixes":{"shape":"S6m"},"EncodingType":{}}}},"ListObjectVersions":{"http":{"method":"GET","requestUri":"/{Bucket}?versions"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Delimiter":{"location":"querystring","locationName":"delimiter"},"EncodingType":{"location":"querystring","locationName":"encoding-type"},"KeyMarker":{"location":"querystring","locationName":"key-marker"},"MaxKeys":{"location":"querystring","locationName":"max-keys","type":"integer"},"Prefix":{"location":"querystring","locationName":"prefix"},"VersionIdMarker":{"location":"querystring","locationName":"version-id-marker"}}},"output":{"type":"structure","members":{"IsTruncated":{"type":"boolean"},"KeyMarker":{},"VersionIdMarker":{},"NextKeyMarker":{},"NextVersionIdMarker":{},"Versions":{"locationName":"Version","type":"list","member":{"type":"structure","members":{"ETag":{},"Size":{"type":"integer"},"StorageClass":{},"Key":{},"VersionId":{},"IsLatest":{"type":"boolean"},"LastModified":{"type":"timestamp"},"Owner":{"shape":"S2f"}}},"flattened":true},"DeleteMarkers":{"locationName":"DeleteMarker","type":"list","member":{"type":"structure","members":{"Owner":{"shape":"S2f"},"Key":{},"VersionId":{},"IsLatest":{"type":"boolean"},"LastModified":{"type":"timestamp"}}},"flattened":true},"Name":{},"Prefix":{},"Delimiter":{},"MaxKeys":{"type":"integer"},"CommonPrefixes":{"shape":"S6m"},"EncodingType":{}}},"alias":"GetBucketObjectVersions"},"ListObjects":{"http":{"method":"GET","requestUri":"/{Bucket}"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Delimiter":{"location":"querystring","locationName":"delimiter"},"EncodingType":{"location":"querystring","locationName":"encoding-type"},"Marker":{"location":"querystring","locationName":"marker"},"MaxKeys":{"location":"querystring","locationName":"max-keys","type":"integer"},"Prefix":{"location":"querystring","locationName":"prefix"}}},"output":{"type":"structure","members":{"IsTruncated":{"type":"boolean"},"Marker":{},"NextMarker":{},"Contents":{"type":"list","member":{"type":"structure","members":{"Key":{},"LastModified":{"type":"timestamp"},"ETag":{},"Size":{"type":"integer"},"StorageClass":{},"Owner":{"shape":"S2f"}}},"flattened":true},"Name":{},"Prefix":{},"Delimiter":{},"MaxKeys":{"type":"integer"},"CommonPrefixes":{"shape":"S6m"},"EncodingType":{}}},"alias":"GetBucket"},"ListParts":{"http":{"method":"GET","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","Key","UploadId"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"MaxParts":{"location":"querystring","locationName":"max-parts","type":"integer"},"PartNumberMarker":{"location":"querystring","locationName":"part-number-marker","type":"integer"},"UploadId":{"location":"querystring","locationName":"uploadId"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"Bucket":{},"Key":{},"UploadId":{},"PartNumberMarker":{"type":"integer"},"NextPartNumberMarker":{"type":"integer"},"MaxParts":{"type":"integer"},"IsTruncated":{"type":"boolean"},"Parts":{"locationName":"Part","type":"list","member":{"type":"structure","members":{"PartNumber":{"type":"integer"},"LastModified":{"type":"timestamp"},"ETag":{},"Size":{"type":"integer"}}},"flattened":true},"Initiator":{"shape":"S6l"},"Owner":{"shape":"S2f"},"StorageClass":{},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}}},"PutBucketAcl":{"http":{"method":"PUT","requestUri":"/{Bucket}?acl"},"input":{"type":"structure","required":["Bucket"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"AccessControlPolicy":{"shape":"S7f","xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"AccessControlPolicy"},"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWrite":{"location":"header","locationName":"x-amz-grant-write"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"}},"payload":"AccessControlPolicy"}},"PutBucketCors":{"http":{"method":"PUT","requestUri":"/{Bucket}?cors"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"CORSConfiguration":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"CORSConfiguration","type":"structure","members":{"CORSRules":{"shape":"S2r","locationName":"CORSRule"}}},"ContentMD5":{"location":"header","locationName":"Content-MD5"}},"payload":"CORSConfiguration"}},"PutBucketLifecycle":{"http":{"method":"PUT","requestUri":"/{Bucket}?lifecycle"},"input":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"LifecycleConfiguration":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"LifecycleConfiguration","type":"structure","required":["Rules"],"members":{"Rules":{"shape":"S34","locationName":"Rule"}}}},"payload":"LifecycleConfiguration"}},"PutBucketLogging":{"http":{"method":"PUT","requestUri":"/{Bucket}?logging"},"input":{"type":"structure","required":["Bucket","BucketLoggingStatus"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"BucketLoggingStatus":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"BucketLoggingStatus","type":"structure","members":{"LoggingEnabled":{"shape":"S3j"}}},"ContentMD5":{"location":"header","locationName":"Content-MD5"}},"payload":"BucketLoggingStatus"}},"PutBucketNotification":{"http":{"method":"PUT","requestUri":"/{Bucket}?notification"},"input":{"type":"structure","required":["Bucket","NotificationConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"NotificationConfiguration":{"shape":"S3q","xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"NotificationConfiguration"}},"payload":"NotificationConfiguration"},"deprecated":true},"PutBucketNotificationConfiguration":{"http":{"method":"PUT","requestUri":"/{Bucket}?notification"},"input":{"type":"structure","required":["Bucket","NotificationConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"NotificationConfiguration":{"shape":"S41","xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"NotificationConfiguration"}},"payload":"NotificationConfiguration"}},"PutBucketPolicy":{"http":{"method":"PUT","requestUri":"/{Bucket}?policy"},"input":{"type":"structure","required":["Bucket","Policy"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"Policy":{}},"payload":"Policy"}},"PutBucketReplication":{"http":{"method":"PUT","requestUri":"/{Bucket}?replication"},"input":{"type":"structure","required":["Bucket","ReplicationConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"ReplicationConfiguration":{"shape":"S4e","xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"ReplicationConfiguration"}},"payload":"ReplicationConfiguration"}},"PutBucketRequestPayment":{"http":{"method":"PUT","requestUri":"/{Bucket}?requestPayment"},"input":{"type":"structure","required":["Bucket","RequestPaymentConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"RequestPaymentConfiguration":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"RequestPaymentConfiguration","type":"structure","required":["Payer"],"members":{"Payer":{}}}},"payload":"RequestPaymentConfiguration"}},"PutBucketTagging":{"http":{"method":"PUT","requestUri":"/{Bucket}?tagging"},"input":{"type":"structure","required":["Bucket","Tagging"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"Tagging":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"Tagging","type":"structure","required":["TagSet"],"members":{"TagSet":{"shape":"S4p"}}}},"payload":"Tagging"}},"PutBucketVersioning":{"http":{"method":"PUT","requestUri":"/{Bucket}?versioning"},"input":{"type":"structure","required":["Bucket","VersioningConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"MFA":{"location":"header","locationName":"x-amz-mfa"},"VersioningConfiguration":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"VersioningConfiguration","type":"structure","members":{"MFADelete":{"locationName":"MfaDelete"},"Status":{}}}},"payload":"VersioningConfiguration"}},"PutBucketWebsite":{"http":{"method":"PUT","requestUri":"/{Bucket}?website"},"input":{"type":"structure","required":["Bucket","WebsiteConfiguration"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"WebsiteConfiguration":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"WebsiteConfiguration","type":"structure","members":{"ErrorDocument":{"shape":"S53"},"IndexDocument":{"shape":"S51"},"RedirectAllRequestsTo":{"shape":"S4y"},"RoutingRules":{"shape":"S54"}}}},"payload":"WebsiteConfiguration"}},"PutObject":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"Body":{"streaming":true,"type":"blob"},"Bucket":{"location":"uri","locationName":"Bucket"},"CacheControl":{"location":"header","locationName":"Cache-Control"},"ContentDisposition":{"location":"header","locationName":"Content-Disposition"},"ContentEncoding":{"location":"header","locationName":"Content-Encoding"},"ContentLanguage":{"location":"header","locationName":"Content-Language"},"ContentLength":{"location":"header","locationName":"Content-Length","type":"integer"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"ContentType":{"location":"header","locationName":"Content-Type"},"Expires":{"location":"header","locationName":"Expires","type":"timestamp"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"},"Key":{"location":"uri","locationName":"Key"},"Metadata":{"shape":"S11","location":"headers","locationName":"x-amz-meta-"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"StorageClass":{"location":"header","locationName":"x-amz-storage-class"},"WebsiteRedirectLocation":{"location":"header","locationName":"x-amz-website-redirect-location"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"shape":"S18","location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}},"payload":"Body"},"output":{"type":"structure","members":{"Expiration":{"location":"header","locationName":"x-amz-expiration"},"ETag":{"location":"header","locationName":"ETag"},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"VersionId":{"location":"header","locationName":"x-amz-version-id"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}}},"PutObjectAcl":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key+}?acl"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"ACL":{"location":"header","locationName":"x-amz-acl"},"AccessControlPolicy":{"shape":"S7f","xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"AccessControlPolicy"},"Bucket":{"location":"uri","locationName":"Bucket"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"GrantFullControl":{"location":"header","locationName":"x-amz-grant-full-control"},"GrantRead":{"location":"header","locationName":"x-amz-grant-read"},"GrantReadACP":{"location":"header","locationName":"x-amz-grant-read-acp"},"GrantWrite":{"location":"header","locationName":"x-amz-grant-write"},"GrantWriteACP":{"location":"header","locationName":"x-amz-grant-write-acp"},"Key":{"location":"uri","locationName":"Key"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}},"payload":"AccessControlPolicy"},"output":{"type":"structure","members":{"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}}},"RestoreObject":{"http":{"requestUri":"/{Bucket}/{Key+}?restore"},"input":{"type":"structure","required":["Bucket","Key"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"Key":{"location":"uri","locationName":"Key"},"VersionId":{"location":"querystring","locationName":"versionId"},"RestoreRequest":{"xmlNamespace":{"uri":"http://s3.amazonaws.com/doc/2006-03-01/"},"locationName":"RestoreRequest","type":"structure","required":["Days"],"members":{"Days":{"type":"integer"}}},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}},"payload":"RestoreRequest"},"output":{"type":"structure","members":{"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}},"alias":"PostObjectRestore"},"UploadPart":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","Key","PartNumber","UploadId"],"members":{"Body":{"streaming":true,"type":"blob"},"Bucket":{"location":"uri","locationName":"Bucket"},"ContentLength":{"location":"header","locationName":"Content-Length","type":"integer"},"ContentMD5":{"location":"header","locationName":"Content-MD5"},"Key":{"location":"uri","locationName":"Key"},"PartNumber":{"location":"querystring","locationName":"partNumber","type":"integer"},"UploadId":{"location":"querystring","locationName":"uploadId"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"shape":"S18","location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}},"payload":"Body"},"output":{"type":"structure","members":{"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"ETag":{"location":"header","locationName":"ETag"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}}}},"UploadPartCopy":{"http":{"method":"PUT","requestUri":"/{Bucket}/{Key+}"},"input":{"type":"structure","required":["Bucket","CopySource","Key","PartNumber","UploadId"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"},"CopySource":{"location":"header","locationName":"x-amz-copy-source"},"CopySourceIfMatch":{"location":"header","locationName":"x-amz-copy-source-if-match"},"CopySourceIfModifiedSince":{"location":"header","locationName":"x-amz-copy-source-if-modified-since","type":"timestamp"},"CopySourceIfNoneMatch":{"location":"header","locationName":"x-amz-copy-source-if-none-match"},"CopySourceIfUnmodifiedSince":{"location":"header","locationName":"x-amz-copy-source-if-unmodified-since","type":"timestamp"},"CopySourceRange":{"location":"header","locationName":"x-amz-copy-source-range"},"Key":{"location":"uri","locationName":"Key"},"PartNumber":{"location":"querystring","locationName":"partNumber","type":"integer"},"UploadId":{"location":"querystring","locationName":"uploadId"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKey":{"shape":"S18","location":"header","locationName":"x-amz-server-side-encryption-customer-key"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"CopySourceSSECustomerAlgorithm":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-algorithm"},"CopySourceSSECustomerKey":{"shape":"S1b","location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-key"},"CopySourceSSECustomerKeyMD5":{"location":"header","locationName":"x-amz-copy-source-server-side-encryption-customer-key-MD5"},"RequestPayer":{"location":"header","locationName":"x-amz-request-payer"}}},"output":{"type":"structure","members":{"CopySourceVersionId":{"location":"header","locationName":"x-amz-copy-source-version-id"},"CopyPartResult":{"type":"structure","members":{"ETag":{},"LastModified":{"type":"timestamp"}}},"ServerSideEncryption":{"location":"header","locationName":"x-amz-server-side-encryption"},"SSECustomerAlgorithm":{"location":"header","locationName":"x-amz-server-side-encryption-customer-algorithm"},"SSECustomerKeyMD5":{"location":"header","locationName":"x-amz-server-side-encryption-customer-key-MD5"},"SSEKMSKeyId":{"shape":"Sj","location":"header","locationName":"x-amz-server-side-encryption-aws-kms-key-id"},"RequestCharged":{"location":"header","locationName":"x-amz-request-charged"}},"payload":"CopyPartResult"}}},"shapes":{"Sj":{"type":"string","sensitive":true},"S11":{"type":"map","key":{},"value":{}},"S18":{"type":"blob","sensitive":true},"S1b":{"type":"blob","sensitive":true},"S2f":{"type":"structure","members":{"DisplayName":{},"ID":{}}},"S2i":{"type":"list","member":{"locationName":"Grant","type":"structure","members":{"Grantee":{"shape":"S2k"},"Permission":{}}}},"S2k":{"type":"structure","required":["Type"],"members":{"DisplayName":{},"EmailAddress":{},"ID":{},"Type":{"xmlAttribute":true,"locationName":"xsi:type"},"URI":{}},"xmlNamespace":{"prefix":"xsi","uri":"http://www.w3.org/2001/XMLSchema-instance"}},"S2r":{"type":"list","member":{"type":"structure","members":{"AllowedHeaders":{"locationName":"AllowedHeader","type":"list","member":{},"flattened":true},"AllowedMethods":{"locationName":"AllowedMethod","type":"list","member":{},"flattened":true},"AllowedOrigins":{"locationName":"AllowedOrigin","type":"list","member":{},"flattened":true},"ExposeHeaders":{"locationName":"ExposeHeader","type":"list","member":{},"flattened":true},"MaxAgeSeconds":{"type":"integer"}}},"flattened":true},"S34":{"type":"list","member":{"type":"structure","required":["Prefix","Status"],"members":{"Expiration":{"type":"structure","members":{"Date":{"shape":"S37"},"Days":{"type":"integer"}}},"ID":{},"Prefix":{},"Status":{},"Transition":{"type":"structure","members":{"Date":{"shape":"S37"},"Days":{"type":"integer"},"StorageClass":{}}},"NoncurrentVersionTransition":{"type":"structure","members":{"NoncurrentDays":{"type":"integer"},"StorageClass":{}}},"NoncurrentVersionExpiration":{"type":"structure","members":{"NoncurrentDays":{"type":"integer"}}}}},"flattened":true},"S37":{"type":"timestamp","timestampFormat":"iso8601"},"S3j":{"type":"structure","members":{"TargetBucket":{},"TargetGrants":{"type":"list","member":{"locationName":"Grant","type":"structure","members":{"Grantee":{"shape":"S2k"},"Permission":{}}}},"TargetPrefix":{}}},"S3p":{"type":"structure","required":["Bucket"],"members":{"Bucket":{"location":"uri","locationName":"Bucket"}}},"S3q":{"type":"structure","members":{"TopicConfiguration":{"type":"structure","members":{"Id":{},"Events":{"shape":"S3t","locationName":"Event"},"Event":{"deprecated":true},"Topic":{}}},"QueueConfiguration":{"type":"structure","members":{"Id":{},"Event":{"deprecated":true},"Events":{"shape":"S3t","locationName":"Event"},"Queue":{}}},"CloudFunctionConfiguration":{"type":"structure","members":{"Id":{},"Event":{"deprecated":true},"Events":{"shape":"S3t","locationName":"Event"},"CloudFunction":{},"InvocationRole":{}}}}},"S3t":{"type":"list","member":{},"flattened":true},"S41":{"type":"structure","members":{"TopicConfigurations":{"locationName":"TopicConfiguration","type":"list","member":{"type":"structure","required":["TopicArn","Events"],"members":{"Id":{},"TopicArn":{"locationName":"Topic"},"Events":{"shape":"S3t","locationName":"Event"}}},"flattened":true},"QueueConfigurations":{"locationName":"QueueConfiguration","type":"list","member":{"type":"structure","required":["QueueArn","Events"],"members":{"Id":{},"QueueArn":{"locationName":"Queue"},"Events":{"shape":"S3t","locationName":"Event"}}},"flattened":true},"LambdaFunctionConfigurations":{"locationName":"CloudFunctionConfiguration","type":"list","member":{"type":"structure","required":["LambdaFunctionArn","Events"],"members":{"Id":{},"LambdaFunctionArn":{"locationName":"CloudFunction"},"Events":{"shape":"S3t","locationName":"Event"}}},"flattened":true}}},"S4e":{"type":"structure","required":["Role","Rules"],"members":{"Role":{},"Rules":{"locationName":"Rule","type":"list","member":{"type":"structure","required":["Prefix","Status","Destination"],"members":{"ID":{},"Prefix":{},"Status":{},"Destination":{"type":"structure","required":["Bucket"],"members":{"Bucket":{}}}}},"flattened":true}}},"S4p":{"type":"list","member":{"locationName":"Tag","type":"structure","required":["Key","Value"],"members":{"Key":{},"Value":{}}}},"S4y":{"type":"structure","required":["HostName"],"members":{"HostName":{},"Protocol":{}}},"S51":{"type":"structure","required":["Suffix"],"members":{"Suffix":{}}},"S53":{"type":"structure","required":["Key"],"members":{"Key":{}}},"S54":{"type":"list","member":{"locationName":"RoutingRule","type":"structure","required":["Redirect"],"members":{"Condition":{"type":"structure","members":{"HttpErrorCodeReturnedEquals":{},"KeyPrefixEquals":{}}},"Redirect":{"type":"structure","members":{"HostName":{},"HttpRedirectCode":{},"Protocol":{},"ReplaceKeyPrefixWith":{},"ReplaceKeyWith":{}}}}}},"S6l":{"type":"structure","members":{"ID":{},"DisplayName":{}}},"S6m":{"type":"list","member":{"type":"structure","members":{"Prefix":{}}},"flattened":true},"S7f":{"type":"structure","members":{"Grants":{"shape":"S2i","locationName":"AccessControlList"},"Owner":{"shape":"S2f"}}}},"examples":{},"paginators":{"ListBuckets":{"result_key":"Buckets"},"ListMultipartUploads":{"limit_key":"MaxUploads","more_results":"IsTruncated","output_token":["NextKeyMarker","NextUploadIdMarker"],"input_token":["KeyMarker","UploadIdMarker"],"result_key":["Uploads","CommonPrefixes"]},"ListObjectVersions":{"more_results":"IsTruncated","limit_key":"MaxKeys","output_token":["NextKeyMarker","NextVersionIdMarker"],"input_token":["KeyMarker","VersionIdMarker"],"result_key":["Versions","DeleteMarkers","CommonPrefixes"]},"ListObjects":{"more_results":"IsTruncated","limit_key":"MaxKeys","output_token":"NextMarker || Contents[-1].Key","input_token":"Marker","result_key":["Contents","CommonPrefixes"]},"ListParts":{"more_results":"IsTruncated","limit_key":"MaxParts","output_token":"NextPartNumberMarker","input_token":"PartNumberMarker","result_key":"Parts"}},"waiters":{"__default__":{"interval":5,"max_attempts":20},"BucketExists":{"operation":"HeadBucket","ignore_errors":[404],"success_type":"output"},"BucketNotExists":{"operation":"HeadBucket","success_type":"error","success_value":404},"ObjectExists":{"operation":"HeadObject","ignore_errors":[404],"success_type":"output"},"ObjectNotExists":{"operation":"HeadObject","success_type":"error","success_value":404}}};
AWS.apiLoader.services['sns'] = {};
AWS.SNS = AWS.Service.defineService('sns', [ '2010-03-31' ]);

AWS.apiLoader.services['sns']['2010-03-31'] = {"metadata":{"apiVersion":"2010-03-31","endpointPrefix":"sns","serviceAbbreviation":"Amazon SNS","serviceFullName":"Amazon Simple Notification Service","signatureVersion":"v4","xmlNamespace":"http://sns.amazonaws.com/doc/2010-03-31/","protocol":"query"},"operations":{"AddPermission":{"input":{"type":"structure","required":["TopicArn","Label","AWSAccountId","ActionName"],"members":{"TopicArn":{},"Label":{},"AWSAccountId":{"type":"list","member":{}},"ActionName":{"type":"list","member":{}}}},"http":{}},"ConfirmSubscription":{"input":{"type":"structure","required":["TopicArn","Token"],"members":{"TopicArn":{},"Token":{},"AuthenticateOnUnsubscribe":{}}},"output":{"resultWrapper":"ConfirmSubscriptionResult","type":"structure","members":{"SubscriptionArn":{}}},"http":{}},"CreatePlatformApplication":{"input":{"type":"structure","required":["Name","Platform","Attributes"],"members":{"Name":{},"Platform":{},"Attributes":{"shape":"Sf"}}},"output":{"resultWrapper":"CreatePlatformApplicationResult","type":"structure","members":{"PlatformApplicationArn":{}}},"http":{}},"CreatePlatformEndpoint":{"input":{"type":"structure","required":["PlatformApplicationArn","Token"],"members":{"PlatformApplicationArn":{},"Token":{},"CustomUserData":{},"Attributes":{"shape":"Sf"}}},"output":{"resultWrapper":"CreatePlatformEndpointResult","type":"structure","members":{"EndpointArn":{}}},"http":{}},"CreateTopic":{"input":{"type":"structure","required":["Name"],"members":{"Name":{}}},"output":{"resultWrapper":"CreateTopicResult","type":"structure","members":{"TopicArn":{}}},"http":{}},"DeleteEndpoint":{"input":{"type":"structure","required":["EndpointArn"],"members":{"EndpointArn":{}}},"http":{}},"DeletePlatformApplication":{"input":{"type":"structure","required":["PlatformApplicationArn"],"members":{"PlatformApplicationArn":{}}},"http":{}},"DeleteTopic":{"input":{"type":"structure","required":["TopicArn"],"members":{"TopicArn":{}}},"http":{}},"GetEndpointAttributes":{"input":{"type":"structure","required":["EndpointArn"],"members":{"EndpointArn":{}}},"output":{"resultWrapper":"GetEndpointAttributesResult","type":"structure","members":{"Attributes":{"shape":"Sf"}}},"http":{}},"GetPlatformApplicationAttributes":{"input":{"type":"structure","required":["PlatformApplicationArn"],"members":{"PlatformApplicationArn":{}}},"output":{"resultWrapper":"GetPlatformApplicationAttributesResult","type":"structure","members":{"Attributes":{"shape":"Sf"}}},"http":{}},"GetSubscriptionAttributes":{"input":{"type":"structure","required":["SubscriptionArn"],"members":{"SubscriptionArn":{}}},"output":{"resultWrapper":"GetSubscriptionAttributesResult","type":"structure","members":{"Attributes":{"type":"map","key":{},"value":{}}}},"http":{}},"GetTopicAttributes":{"input":{"type":"structure","required":["TopicArn"],"members":{"TopicArn":{}}},"output":{"resultWrapper":"GetTopicAttributesResult","type":"structure","members":{"Attributes":{"type":"map","key":{},"value":{}}}},"http":{}},"ListEndpointsByPlatformApplication":{"input":{"type":"structure","required":["PlatformApplicationArn"],"members":{"PlatformApplicationArn":{},"NextToken":{}}},"output":{"resultWrapper":"ListEndpointsByPlatformApplicationResult","type":"structure","members":{"Endpoints":{"type":"list","member":{"type":"structure","members":{"EndpointArn":{},"Attributes":{"shape":"Sf"}}}},"NextToken":{}}},"http":{}},"ListPlatformApplications":{"input":{"type":"structure","members":{"NextToken":{}}},"output":{"resultWrapper":"ListPlatformApplicationsResult","type":"structure","members":{"PlatformApplications":{"type":"list","member":{"type":"structure","members":{"PlatformApplicationArn":{},"Attributes":{"shape":"Sf"}}}},"NextToken":{}}},"http":{}},"ListSubscriptions":{"input":{"type":"structure","members":{"NextToken":{}}},"output":{"resultWrapper":"ListSubscriptionsResult","type":"structure","members":{"Subscriptions":{"shape":"S1c"},"NextToken":{}}},"http":{}},"ListSubscriptionsByTopic":{"input":{"type":"structure","required":["TopicArn"],"members":{"TopicArn":{},"NextToken":{}}},"output":{"resultWrapper":"ListSubscriptionsByTopicResult","type":"structure","members":{"Subscriptions":{"shape":"S1c"},"NextToken":{}}},"http":{}},"ListTopics":{"input":{"type":"structure","members":{"NextToken":{}}},"output":{"resultWrapper":"ListTopicsResult","type":"structure","members":{"Topics":{"type":"list","member":{"type":"structure","members":{"TopicArn":{}}}},"NextToken":{}}},"http":{}},"Publish":{"input":{"type":"structure","required":["Message"],"members":{"TopicArn":{},"TargetArn":{},"Message":{},"Subject":{},"MessageStructure":{},"MessageAttributes":{"type":"map","key":{"locationName":"Name"},"value":{"locationName":"Value","type":"structure","required":["DataType"],"members":{"DataType":{},"StringValue":{},"BinaryValue":{"type":"blob"}}}}}},"output":{"resultWrapper":"PublishResult","type":"structure","members":{"MessageId":{}}},"http":{}},"RemovePermission":{"input":{"type":"structure","required":["TopicArn","Label"],"members":{"TopicArn":{},"Label":{}}},"http":{}},"SetEndpointAttributes":{"input":{"type":"structure","required":["EndpointArn","Attributes"],"members":{"EndpointArn":{},"Attributes":{"shape":"Sf"}}},"http":{}},"SetPlatformApplicationAttributes":{"input":{"type":"structure","required":["PlatformApplicationArn","Attributes"],"members":{"PlatformApplicationArn":{},"Attributes":{"shape":"Sf"}}},"http":{}},"SetSubscriptionAttributes":{"input":{"type":"structure","required":["SubscriptionArn","AttributeName"],"members":{"SubscriptionArn":{},"AttributeName":{},"AttributeValue":{}}},"http":{}},"SetTopicAttributes":{"input":{"type":"structure","required":["TopicArn","AttributeName"],"members":{"TopicArn":{},"AttributeName":{},"AttributeValue":{}}},"http":{}},"Subscribe":{"input":{"type":"structure","required":["TopicArn","Protocol"],"members":{"TopicArn":{},"Protocol":{},"Endpoint":{}}},"output":{"resultWrapper":"SubscribeResult","type":"structure","members":{"SubscriptionArn":{}}},"http":{}},"Unsubscribe":{"input":{"type":"structure","required":["SubscriptionArn"],"members":{"SubscriptionArn":{}}},"http":{}}},"shapes":{"Sf":{"type":"map","key":{},"value":{}},"S1c":{"type":"list","member":{"type":"structure","members":{"SubscriptionArn":{},"Owner":{},"Protocol":{},"Endpoint":{},"TopicArn":{}}}}},"paginators":{"ListEndpointsByPlatformApplication":{"input_token":"NextToken","output_token":"NextToken","result_key":"Endpoints"},"ListPlatformApplications":{"input_token":"NextToken","output_token":"NextToken","result_key":"PlatformApplications"},"ListSubscriptions":{"input_token":"NextToken","output_token":"NextToken","result_key":"Subscriptions"},"ListSubscriptionsByTopic":{"input_token":"NextToken","output_token":"NextToken","result_key":"Subscriptions"},"ListTopics":{"input_token":"NextToken","output_token":"NextToken","result_key":"Topics"}}};
AWS.apiLoader.services['sqs'] = {};
AWS.SQS = AWS.Service.defineService('sqs', [ '2012-11-05' ]);
require('./services/sqs');

AWS.apiLoader.services['sqs']['2012-11-05'] = {"metadata":{"apiVersion":"2012-11-05","endpointPrefix":"sqs","serviceAbbreviation":"Amazon SQS","serviceFullName":"Amazon Simple Queue Service","signatureVersion":"v4","xmlNamespace":"http://queue.amazonaws.com/doc/2012-11-05/","protocol":"query"},"operations":{"AddPermission":{"input":{"type":"structure","required":["QueueUrl","Label","AWSAccountIds","Actions"],"members":{"QueueUrl":{},"Label":{},"AWSAccountIds":{"type":"list","member":{"locationName":"AWSAccountId"},"flattened":true},"Actions":{"type":"list","member":{"locationName":"ActionName"},"flattened":true}}},"http":{}},"ChangeMessageVisibility":{"input":{"type":"structure","required":["QueueUrl","ReceiptHandle","VisibilityTimeout"],"members":{"QueueUrl":{},"ReceiptHandle":{},"VisibilityTimeout":{"type":"integer"}}},"http":{}},"ChangeMessageVisibilityBatch":{"input":{"type":"structure","required":["QueueUrl","Entries"],"members":{"QueueUrl":{},"Entries":{"type":"list","member":{"locationName":"ChangeMessageVisibilityBatchRequestEntry","type":"structure","required":["Id","ReceiptHandle"],"members":{"Id":{},"ReceiptHandle":{},"VisibilityTimeout":{"type":"integer"}}},"flattened":true}}},"output":{"resultWrapper":"ChangeMessageVisibilityBatchResult","type":"structure","required":["Successful","Failed"],"members":{"Successful":{"type":"list","member":{"locationName":"ChangeMessageVisibilityBatchResultEntry","type":"structure","required":["Id"],"members":{"Id":{}}},"flattened":true},"Failed":{"shape":"Sd"}}},"http":{}},"CreateQueue":{"input":{"type":"structure","required":["QueueName"],"members":{"QueueName":{},"Attributes":{"shape":"Sh","locationName":"Attribute"}}},"output":{"resultWrapper":"CreateQueueResult","type":"structure","members":{"QueueUrl":{}}},"http":{}},"DeleteMessage":{"input":{"type":"structure","required":["QueueUrl","ReceiptHandle"],"members":{"QueueUrl":{},"ReceiptHandle":{}}},"http":{}},"DeleteMessageBatch":{"input":{"type":"structure","required":["QueueUrl","Entries"],"members":{"QueueUrl":{},"Entries":{"type":"list","member":{"locationName":"DeleteMessageBatchRequestEntry","type":"structure","required":["Id","ReceiptHandle"],"members":{"Id":{},"ReceiptHandle":{}}},"flattened":true}}},"output":{"resultWrapper":"DeleteMessageBatchResult","type":"structure","required":["Successful","Failed"],"members":{"Successful":{"type":"list","member":{"locationName":"DeleteMessageBatchResultEntry","type":"structure","required":["Id"],"members":{"Id":{}}},"flattened":true},"Failed":{"shape":"Sd"}}},"http":{}},"DeleteQueue":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{}}},"http":{}},"GetQueueAttributes":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{},"AttributeNames":{"shape":"St"}}},"output":{"resultWrapper":"GetQueueAttributesResult","type":"structure","members":{"Attributes":{"shape":"Sh","locationName":"Attribute"}}},"http":{}},"GetQueueUrl":{"input":{"type":"structure","required":["QueueName"],"members":{"QueueName":{},"QueueOwnerAWSAccountId":{}}},"output":{"resultWrapper":"GetQueueUrlResult","type":"structure","members":{"QueueUrl":{}}},"http":{}},"ListDeadLetterSourceQueues":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{}}},"output":{"resultWrapper":"ListDeadLetterSourceQueuesResult","type":"structure","required":["queueUrls"],"members":{"queueUrls":{"shape":"Sz"}}},"http":{}},"ListQueues":{"input":{"type":"structure","members":{"QueueNamePrefix":{}}},"output":{"resultWrapper":"ListQueuesResult","type":"structure","members":{"QueueUrls":{"shape":"Sz"}}},"http":{}},"PurgeQueue":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{}}},"http":{}},"ReceiveMessage":{"input":{"type":"structure","required":["QueueUrl"],"members":{"QueueUrl":{},"AttributeNames":{"shape":"St"},"MessageAttributeNames":{"type":"list","member":{"locationName":"MessageAttributeName"},"flattened":true},"MaxNumberOfMessages":{"type":"integer"},"VisibilityTimeout":{"type":"integer"},"WaitTimeSeconds":{"type":"integer"}}},"output":{"resultWrapper":"ReceiveMessageResult","type":"structure","members":{"Messages":{"type":"list","member":{"locationName":"Message","type":"structure","members":{"MessageId":{},"ReceiptHandle":{},"MD5OfBody":{},"Body":{},"Attributes":{"shape":"Sh","locationName":"Attribute"},"MD5OfMessageAttributes":{},"MessageAttributes":{"shape":"S19","locationName":"MessageAttribute"}}},"flattened":true}}},"http":{}},"RemovePermission":{"input":{"type":"structure","required":["QueueUrl","Label"],"members":{"QueueUrl":{},"Label":{}}},"http":{}},"SendMessage":{"input":{"type":"structure","required":["QueueUrl","MessageBody"],"members":{"QueueUrl":{},"MessageBody":{},"DelaySeconds":{"type":"integer"},"MessageAttributes":{"shape":"S19","locationName":"MessageAttribute"}}},"output":{"resultWrapper":"SendMessageResult","type":"structure","members":{"MD5OfMessageBody":{},"MD5OfMessageAttributes":{},"MessageId":{}}},"http":{}},"SendMessageBatch":{"input":{"type":"structure","required":["QueueUrl","Entries"],"members":{"QueueUrl":{},"Entries":{"type":"list","member":{"locationName":"SendMessageBatchRequestEntry","type":"structure","required":["Id","MessageBody"],"members":{"Id":{},"MessageBody":{},"DelaySeconds":{"type":"integer"},"MessageAttributes":{"shape":"S19","locationName":"MessageAttribute"}}},"flattened":true}}},"output":{"resultWrapper":"SendMessageBatchResult","type":"structure","required":["Successful","Failed"],"members":{"Successful":{"type":"list","member":{"locationName":"SendMessageBatchResultEntry","type":"structure","required":["Id","MessageId","MD5OfMessageBody"],"members":{"Id":{},"MessageId":{},"MD5OfMessageBody":{},"MD5OfMessageAttributes":{}}},"flattened":true},"Failed":{"shape":"Sd"}}},"http":{}},"SetQueueAttributes":{"input":{"type":"structure","required":["QueueUrl","Attributes"],"members":{"QueueUrl":{},"Attributes":{"shape":"Sh","locationName":"Attribute"}}},"http":{}}},"shapes":{"Sd":{"type":"list","member":{"locationName":"BatchResultErrorEntry","type":"structure","required":["Id","SenderFault","Code"],"members":{"Id":{},"SenderFault":{"type":"boolean"},"Code":{},"Message":{}}},"flattened":true},"Sh":{"type":"map","key":{"locationName":"Name"},"value":{"locationName":"Value"},"flattened":true,"locationName":"Attribute"},"St":{"type":"list","member":{"locationName":"AttributeName"},"flattened":true},"Sz":{"type":"list","member":{"locationName":"QueueUrl"},"flattened":true},"S19":{"type":"map","key":{"locationName":"Name"},"value":{"locationName":"Value","type":"structure","required":["DataType"],"members":{"StringValue":{},"BinaryValue":{"type":"blob"},"StringListValues":{"flattened":true,"locationName":"StringListValue","type":"list","member":{"locationName":"StringListValue"}},"BinaryListValues":{"flattened":true,"locationName":"BinaryListValue","type":"list","member":{"locationName":"BinaryListValue","type":"blob"}},"DataType":{}}},"flattened":true}},"paginators":{"ListQueues":{"result_key":"QueueUrls"}}};
AWS.apiLoader.services['sts'] = {};
AWS.STS = AWS.Service.defineService('sts', [ '2011-06-15' ]);
require('./services/sts');

AWS.apiLoader.services['sts']['2011-06-15'] = {"version":"2.0","metadata":{"apiVersion":"2011-06-15","endpointPrefix":"sts","globalEndpoint":"sts.amazonaws.com","serviceAbbreviation":"AWS STS","serviceFullName":"AWS Security Token Service","signatureVersion":"v4","xmlNamespace":"https://sts.amazonaws.com/doc/2011-06-15/","protocol":"query"},"operations":{"AssumeRole":{"input":{"type":"structure","required":["RoleArn","RoleSessionName"],"members":{"RoleArn":{},"RoleSessionName":{},"Policy":{},"DurationSeconds":{"type":"integer"},"ExternalId":{},"SerialNumber":{},"TokenCode":{}}},"output":{"resultWrapper":"AssumeRoleResult","type":"structure","members":{"Credentials":{"shape":"Sa"},"AssumedRoleUser":{"shape":"Sf"},"PackedPolicySize":{"type":"integer"}}},"http":{}},"AssumeRoleWithSAML":{"input":{"type":"structure","required":["RoleArn","PrincipalArn","SAMLAssertion"],"members":{"RoleArn":{},"PrincipalArn":{},"SAMLAssertion":{},"Policy":{},"DurationSeconds":{"type":"integer"}}},"output":{"resultWrapper":"AssumeRoleWithSAMLResult","type":"structure","members":{"Credentials":{"shape":"Sa"},"AssumedRoleUser":{"shape":"Sf"},"PackedPolicySize":{"type":"integer"},"Subject":{},"SubjectType":{},"Issuer":{},"Audience":{},"NameQualifier":{}}},"http":{}},"AssumeRoleWithWebIdentity":{"input":{"type":"structure","required":["RoleArn","RoleSessionName","WebIdentityToken"],"members":{"RoleArn":{},"RoleSessionName":{},"WebIdentityToken":{},"ProviderId":{},"Policy":{},"DurationSeconds":{"type":"integer"}}},"output":{"resultWrapper":"AssumeRoleWithWebIdentityResult","type":"structure","members":{"Credentials":{"shape":"Sa"},"SubjectFromWebIdentityToken":{},"AssumedRoleUser":{"shape":"Sf"},"PackedPolicySize":{"type":"integer"},"Provider":{},"Audience":{}}},"http":{}},"DecodeAuthorizationMessage":{"input":{"type":"structure","required":["EncodedMessage"],"members":{"EncodedMessage":{}}},"output":{"resultWrapper":"DecodeAuthorizationMessageResult","type":"structure","members":{"DecodedMessage":{}}},"http":{}},"GetFederationToken":{"input":{"type":"structure","required":["Name"],"members":{"Name":{},"Policy":{},"DurationSeconds":{"type":"integer"}}},"output":{"resultWrapper":"GetFederationTokenResult","type":"structure","members":{"Credentials":{"shape":"Sa"},"FederatedUser":{"type":"structure","required":["FederatedUserId","Arn"],"members":{"FederatedUserId":{},"Arn":{}}},"PackedPolicySize":{"type":"integer"}}},"http":{}},"GetSessionToken":{"input":{"type":"structure","members":{"DurationSeconds":{"type":"integer"},"SerialNumber":{},"TokenCode":{}}},"output":{"resultWrapper":"GetSessionTokenResult","type":"structure","members":{"Credentials":{"shape":"Sa"}}},"http":{}}},"shapes":{"Sa":{"type":"structure","required":["AccessKeyId","SecretAccessKey","SessionToken","Expiration"],"members":{"AccessKeyId":{},"SecretAccessKey":{},"SessionToken":{},"Expiration":{"type":"timestamp"}}},"Sf":{"type":"structure","required":["AssumedRoleId","Arn"],"members":{"AssumedRoleId":{},"Arn":{}}}}};

},{"./core":3,"./http/xhr":12,"./services/cognitoidentity":36,"./services/dynamodb":37,"./services/ec2":38,"./services/machinelearning":39,"./services/s3":40,"./services/sqs":41,"./services/sts":42,"./xml/browser_parser":52}],2:[function(require,module,exports){
var AWS = require('./core');
require('./credentials');
require('./credentials/credential_provider_chain');


AWS.Config = AWS.util.inherit({



  constructor: function Config(options) {
    if (options === undefined) options = {};
    options = this.extractCredentials(options);

    AWS.util.each.call(this, this.keys, function (key, value) {
      this.set(key, options[key], value);
    });
  },




  getCredentials: function getCredentials(callback) {
    var self = this;

    function finish(err) {
      callback(err, err ? null : self.credentials);
    }

    function credError(msg, err) {
      return new AWS.util.error(err || new Error(), {
        code: 'CredentialsError', message: msg
      });
    }

    function getAsyncCredentials() {
      self.credentials.get(function(err) {
        if (err) {
          var msg = 'Could not load credentials from ' +
            self.credentials.constructor.name;
          err = credError(msg, err);
        }
        finish(err);
      });
    }

    function getStaticCredentials() {
      var err = null;
      if (!self.credentials.accessKeyId || !self.credentials.secretAccessKey) {
        err = credError('Missing credentials');
      }
      finish(err);
    }

    if (self.credentials) {
      if (typeof self.credentials.get === 'function') {
        getAsyncCredentials();
      } else { // static credentials
        getStaticCredentials();
      }
    } else if (self.credentialProvider) {
      self.credentialProvider.resolve(function(err, creds) {
        if (err) {
          err = credError('Could not load credentials from any providers', err);
        }
        self.credentials = creds;
        finish(err);
      });
    } else {
      finish(credError('No credentials to load'));
    }
  },




  update: function update(options, allowUnknownKeys) {
    allowUnknownKeys = allowUnknownKeys || false;
    options = this.extractCredentials(options);
    AWS.util.each.call(this, options, function (key, value) {
      if (allowUnknownKeys || this.keys.hasOwnProperty(key) ||
          AWS.Service.hasService(key)) {
        this.set(key, value);
      }
    });
  },


  loadFromPath: function loadFromPath(path) {
    this.clear();

    var options = JSON.parse(AWS.util.readFileSync(path));
    var fileSystemCreds = new AWS.FileSystemCredentials(path);
    var chain = new AWS.CredentialProviderChain();
    chain.providers.unshift(fileSystemCreds);
    chain.resolve(function (err, creds) {
      if (err) throw err;
      else options.credentials = creds;
    });

    this.constructor(options);

    return this;
  },


  clear: function clear() {

    AWS.util.each.call(this, this.keys, function (key) {
      delete this[key];
    });

    this.set('credentials', undefined);
    this.set('credentialProvider', undefined);
  },


  set: function set(property, value, defaultValue) {
    if (value === undefined) {
      if (defaultValue === undefined) {
        defaultValue = this.keys[property];
      }
      if (typeof defaultValue === 'function') {
        this[property] = defaultValue.call(this);
      } else {
        this[property] = defaultValue;
      }
    } else if (property === 'httpOptions' && this[property]) {
      this[property] = AWS.util.merge(this[property], value);
    } else {
      this[property] = value;
    }
  },


  keys: {
    credentials: null,
    credentialProvider: null,
    region: null,
    logger: null,
    apiVersions: {},
    apiVersion: null,
    endpoint: undefined,
    httpOptions: {
      timeout: 120000
    },
    maxRetries: undefined,
    maxRedirects: 10,
    paramValidation: true,
    sslEnabled: true,
    s3ForcePathStyle: false,
    s3BucketEndpoint: false,
    computeChecksums: true,
    convertResponseTypes: true,
    dynamoDbCrc32: true,
    systemClockOffset: 0,
    signatureVersion: null
  },


  extractCredentials: function extractCredentials(options) {
    if (options.accessKeyId && options.secretAccessKey) {
      options = AWS.util.copy(options);
      options.credentials = new AWS.Credentials(options);
    }
    return options;
  }
});


AWS.config = new AWS.Config();

},{"./core":3,"./credentials":4,"./credentials/credential_provider_chain":6}],3:[function(require,module,exports){

var AWS = { util: require('./util') };


var _hidden = {}; _hidden.toString(); // hack to parse macro

module.exports = AWS;

AWS.util.update(AWS, {


  VERSION: '2.1.42',


  Signers: {},


  Protocol: {
    Json: require('./protocol/json'),
    Query: require('./protocol/query'),
    Rest: require('./protocol/rest'),
    RestJson: require('./protocol/rest_json'),
    RestXml: require('./protocol/rest_xml')
  },


  XML: {
    Builder: require('./xml/builder'),
    Parser: null // conditionally set based on environment
  },


  JSON: {
    Builder: require('./json/builder'),
    Parser: require('./json/parser')
  },


  Model: {
    Api: require('./model/api'),
    Operation: require('./model/operation'),
    Shape: require('./model/shape'),
    Paginator: require('./model/paginator'),
    ResourceWaiter: require('./model/resource_waiter')
  },

  util: require('./util'),


  apiLoader: function() { throw new Error('No API loader set'); }
});

require('./service');

require('./credentials');
require('./credentials/credential_provider_chain');
require('./credentials/temporary_credentials');
require('./credentials/web_identity_credentials');
require('./credentials/cognito_identity_credentials');
require('./credentials/saml_credentials');

require('./config');
require('./http');
require('./sequential_executor');
require('./event_listeners');
require('./request');
require('./response');
require('./resource_waiter');
require('./signers/request_signer');
require('./param_validator');


AWS.events = new AWS.SequentialExecutor();

},{"./config":2,"./credentials":4,"./credentials/cognito_identity_credentials":5,"./credentials/credential_provider_chain":6,"./credentials/saml_credentials":7,"./credentials/temporary_credentials":8,"./credentials/web_identity_credentials":9,"./event_listeners":10,"./http":11,"./json/builder":13,"./json/parser":14,"./model/api":15,"./model/operation":17,"./model/paginator":18,"./model/resource_waiter":19,"./model/shape":20,"./param_validator":21,"./protocol/json":22,"./protocol/query":23,"./protocol/rest":24,"./protocol/rest_json":25,"./protocol/rest_xml":26,"./request":30,"./resource_waiter":31,"./response":32,"./sequential_executor":34,"./service":35,"./signers/request_signer":44,"./util":51,"./xml/builder":53}],4:[function(require,module,exports){
var AWS = require('./core');


AWS.Credentials = AWS.util.inherit({

  constructor: function Credentials() {
    AWS.util.hideProperties(this, ['secretAccessKey']);

    this.expired = false;
    this.expireTime = null;
    if (arguments.length === 1 && typeof arguments[0] === 'object') {
      var creds = arguments[0].credentials || arguments[0];
      this.accessKeyId = creds.accessKeyId;
      this.secretAccessKey = creds.secretAccessKey;
      this.sessionToken = creds.sessionToken;
    } else {
      this.accessKeyId = arguments[0];
      this.secretAccessKey = arguments[1];
      this.sessionToken = arguments[2];
    }
  },


  expiryWindow: 15,


  needsRefresh: function needsRefresh() {
    var currentTime = AWS.util.date.getDate().getTime();
    var adjustedTime = new Date(currentTime + this.expiryWindow * 1000);

    if (this.expireTime && adjustedTime > this.expireTime) {
      return true;
    } else {
      return this.expired || !this.accessKeyId || !this.secretAccessKey;
    }
  },


  get: function get(callback) {
    var self = this;
    if (this.needsRefresh()) {
      this.refresh(function(err) {
        if (!err) self.expired = false; // reset expired flag
        if (callback) callback(err);
      });
    } else if (callback) {
      callback();
    }
  },


  refresh: function refresh(callback) {
    this.expired = false;
    callback();
  }
});

},{"./core":3}],5:[function(require,module,exports){
var AWS = require('../core');


AWS.CognitoIdentityCredentials = AWS.util.inherit(AWS.Credentials, {

  localStorageKey: {
    id: 'aws.cognito.identity-id.',
    providers: 'aws.cognito.identity-providers.'
  },


  constructor: function CognitoIdentityCredentials(params) {
    AWS.Credentials.call(this);
    this.expired = true;
    this.params = params;
    this.data = null;
    this.identityId = null;
    this.loadCachedId();
  },


  refresh: function refresh(callback) {
    var self = this;
    self.createClients();
    self.data = null;
    self.identityId = null;
    self.getId(function(err) {
      if (!err) {
        if (!self.params.RoleArn) {
          self.getCredentialsForIdentity(callback);
        } else {
          self.getCredentialsFromSTS(callback);
        }
      } else {
        self.clearCachedId();
        callback(err);
      }
    });
  },


  clearCachedId: function clearCache() {
    this.identityId = null;
    delete this.params.IdentityId;

    var poolId = this.params.IdentityPoolId;
    delete this.storage[this.localStorageKey.id + poolId];
    delete this.storage[this.localStorageKey.providers + poolId];
  },


  getId: function getId(callback) {
    var self = this;
    if (typeof self.params.IdentityId === 'string') {
      return callback(null, self.params.IdentityId);
    }

    self.cognito.getId(function(err, data) {
      if (!err && data.IdentityId) {
        self.params.IdentityId = data.IdentityId;
        callback(null, data.IdentityId);
      } else {
        callback(err);
      }
    });
  },



  loadCredentials: function loadCredentials(data, credentials) {
    if (!data || !credentials) return;
    credentials.expired = false;
    credentials.accessKeyId = data.Credentials.AccessKeyId;
    credentials.secretAccessKey = data.Credentials.SecretKey;
    credentials.sessionToken = data.Credentials.SessionToken;
    credentials.expireTime = data.Credentials.Expiration;
  },


  getCredentialsForIdentity: function getCredentialsForIdentity(callback) {
    var self = this;
    self.cognito.getCredentialsForIdentity(function(err, data) {
      if (!err) {
        self.cacheId(data);
        self.data = data;
        self.loadCredentials(self.data, self);
      } else {
        self.clearCachedId();
      }
      callback(err);
    });
  },


  getCredentialsFromSTS: function getCredentialsFromSTS(callback) {
    var self = this;
    self.cognito.getOpenIdToken(function(err, data) {
      if (!err) {
        self.cacheId(data);
        self.params.WebIdentityToken = data.Token;
        self.webIdentityCredentials.refresh(function(webErr) {
          if (!webErr) {
            self.data = self.webIdentityCredentials.data;
            self.sts.credentialsFrom(self.data, self);
          } else {
            self.clearCachedId();
          }
          callback(webErr);
        });
      } else {
        self.clearCachedId();
        callback(err);
      }
    });
  },


  loadCachedId: function loadCachedId() {
    var self = this;

    if (AWS.util.isBrowser() && !self.params.IdentityId) {
      var id = self.getStorage('id');
      if (id && self.params.Logins) {
        var actualProviders = Object.keys(self.params.Logins);
        var cachedProviders =
          (self.getStorage('providers') || '').split(',');

        var intersect = cachedProviders.filter(function(n) {
          return actualProviders.indexOf(n) !== -1;
        });
        if (intersect.length !== 0) {
          self.params.IdentityId = id;
        }
      } else if (id) {
        self.params.IdentityId = id;
      }
    }
  },


  createClients: function() {
    this.webIdentityCredentials = this.webIdentityCredentials ||
      new AWS.WebIdentityCredentials(this.params);
    this.cognito = this.cognito ||
      new AWS.CognitoIdentity({params: this.params});
    this.sts = this.sts || new AWS.STS();
  },


  cacheId: function cacheId(data) {
    this.identityId = data.IdentityId;
    this.params.IdentityId = this.identityId;

    if (AWS.util.isBrowser()) {
      this.setStorage('id', data.IdentityId);

      if (this.params.Logins) {
        this.setStorage('providers', Object.keys(this.params.Logins).join(','));
      }
    }
  },


  getStorage: function getStorage(key) {
    return this.storage[this.localStorageKey[key] + this.params.IdentityPoolId];
  },


  setStorage: function setStorage(key, val) {
    try {
      this.storage[this.localStorageKey[key] + this.params.IdentityPoolId] = val;
    } catch (_) {}
  },


  storage: (function() {
    try {
      return AWS.util.isBrowser() && typeof window.localStorage === 'object' ?
             window.localStorage : {};
    } catch (_) {
      return {};
    }
  })()
});

},{"../core":3}],6:[function(require,module,exports){
var AWS = require('../core');


AWS.CredentialProviderChain = AWS.util.inherit(AWS.Credentials, {


  constructor: function CredentialProviderChain(providers) {
    if (providers) {
      this.providers = providers;
    } else {
      this.providers = AWS.CredentialProviderChain.defaultProviders.slice(0);
    }
  },


  resolve: function resolve(callback) {
    if (this.providers.length === 0) {
      callback(new Error('No providers'));
      return this;
    }

    var index = 0;
    var providers = this.providers.slice(0);

    function resolveNext(err, creds) {
      if ((!err && creds) || index === providers.length) {
        callback(err, creds);
        return;
      }

      var provider = providers[index++];
      if (typeof provider === 'function') {
        creds = provider.call();
      } else {
        creds = provider;
      }

      if (creds.get) {
        creds.get(function(getErr) {
          resolveNext(getErr, getErr ? null : creds);
        });
      } else {
        resolveNext(null, creds);
      }
    }

    resolveNext();
    return this;
  }

});


AWS.CredentialProviderChain.defaultProviders = [];

},{"../core":3}],7:[function(require,module,exports){
var AWS = require('../core');


AWS.SAMLCredentials = AWS.util.inherit(AWS.Credentials, {

  constructor: function SAMLCredentials(params) {
    AWS.Credentials.call(this);
    this.expired = true;
    this.params = params;
  },


  refresh: function refresh(callback) {
    var self = this;
    self.createClients();
    if (!callback) callback = function(err) { if (err) throw err; };

    self.service.assumeRoleWithSAML(function (err, data) {
      if (!err) {
        self.service.credentialsFrom(data, self);
      }
      callback(err);
    });
  },


  createClients: function() {
    this.service = this.service || new AWS.STS({params: this.params});
  }

});

},{"../core":3}],8:[function(require,module,exports){
var AWS = require('../core');


AWS.TemporaryCredentials = AWS.util.inherit(AWS.Credentials, {

  constructor: function TemporaryCredentials(params) {
    AWS.Credentials.call(this);
    this.loadMasterCredentials();
    this.expired = true;

    this.params = params || {};
    if (this.params.RoleArn) {
      this.params.RoleSessionName =
        this.params.RoleSessionName || 'temporary-credentials';
    }
  },


  refresh: function refresh(callback) {
    var self = this;
    self.createClients();
    if (!callback) callback = function(err) { if (err) throw err; };

    self.service.config.credentials = self.masterCredentials;
    var operation = self.params.RoleArn ?
      self.service.assumeRole : self.service.getSessionToken;
    operation.call(self.service, function (err, data) {
      if (!err) {
        self.service.credentialsFrom(data, self);
      }
      callback(err);
    });
  },


  loadMasterCredentials: function loadMasterCredentials() {
    this.masterCredentials = AWS.config.credentials;
    while (this.masterCredentials.masterCredentials) {
      this.masterCredentials = this.masterCredentials.masterCredentials;
    }
  },


  createClients: function() {
    this.service = this.service || new AWS.STS({params: this.params});
  }

});

},{"../core":3}],9:[function(require,module,exports){
var AWS = require('../core');


AWS.WebIdentityCredentials = AWS.util.inherit(AWS.Credentials, {

  constructor: function WebIdentityCredentials(params) {
    AWS.Credentials.call(this);
    this.expired = true;
    this.params = params;
    this.params.RoleSessionName = this.params.RoleSessionName || 'web-identity';
    this.data = null;
  },


  refresh: function refresh(callback) {
    var self = this;
    self.createClients();
    if (!callback) callback = function(err) { if (err) throw err; };

    self.service.assumeRoleWithWebIdentity(function (err, data) {
      self.data = null;
      if (!err) {
        self.data = data;
        self.service.credentialsFrom(data, self);
      }
      callback(err);
    });
  },


  createClients: function() {
    this.service = this.service || new AWS.STS({params: this.params});
  }

});

},{"../core":3}],10:[function(require,module,exports){
var AWS = require('./core');
var SequentialExecutor = require('./sequential_executor');


AWS.EventListeners = {

  Core: {} /* doc hack */
};

AWS.EventListeners = {
  Core: new SequentialExecutor().addNamedListeners(function(add, addAsync) {
    addAsync('VALIDATE_CREDENTIALS', 'validate',
        function VALIDATE_CREDENTIALS(req, done) {
      if (!req.service.api.signatureVersion) return done(); // none
      req.service.config.getCredentials(function(err) {
        if (err) {
          req.response.error = AWS.util.error(err,
            {code: 'CredentialsError', message: 'Missing credentials in config'});
        }
        done();
      });
    });

    add('VALIDATE_REGION', 'validate', function VALIDATE_REGION(req) {
      if (!req.service.config.region && !req.service.isGlobalEndpoint) {
        req.response.error = AWS.util.error(new Error(),
          {code: 'ConfigError', message: 'Missing region in config'});
      }
    });

    add('VALIDATE_PARAMETERS', 'validate', function VALIDATE_PARAMETERS(req) {
      var rules = req.service.api.operations[req.operation].input;
      new AWS.ParamValidator().validate(rules, req.params);
    });

    addAsync('COMPUTE_SHA256', 'afterBuild', function COMPUTE_SHA256(req, done) {
      req.haltHandlersOnError();
      if (!req.service.api.signatureVersion) return done(); // none
      if (req.service.getSignerClass(req) === AWS.Signers.V4) {
        var body = req.httpRequest.body || '';
        AWS.util.computeSha256(body, function(err, sha) {
          if (err) {
            done(err);
          }
          else {
            req.httpRequest.headers['X-Amz-Content-Sha256'] = sha;
            done();
          }
        });
      } else {
        done();
      }
    });

    add('SET_CONTENT_LENGTH', 'afterBuild', function SET_CONTENT_LENGTH(req) {
      if (req.httpRequest.headers['Content-Length'] === undefined) {
        var length = AWS.util.string.byteLength(req.httpRequest.body);
        req.httpRequest.headers['Content-Length'] = length;
      }
    });

    add('SET_HTTP_HOST', 'afterBuild', function SET_HTTP_HOST(req) {
      req.httpRequest.headers['Host'] = req.httpRequest.endpoint.host;
    });

    add('RESTART', 'restart', function RESTART() {
      var err = this.response.error;
      if (!err || !err.retryable) return;

      this.httpRequest = new AWS.HttpRequest(
        this.service.endpoint,
        this.service.region
      );

      if (this.response.retryCount < this.service.config.maxRetries) {
        this.response.retryCount++;
      } else {
        this.response.error = null;
      }
    });

    addAsync('SIGN', 'sign', function SIGN(req, done) {
      if (!req.service.api.signatureVersion) return done(); // none

      req.service.config.getCredentials(function (err, credentials) {
        if (err) {
          req.response.error = err;
          return done();
        }

        try {
          var date = AWS.util.date.getDate();
          var SignerClass = req.service.getSignerClass(req);
          var signer = new SignerClass(req.httpRequest,
            req.service.api.signingName || req.service.api.endpointPrefix);

          delete req.httpRequest.headers['Authorization'];
          delete req.httpRequest.headers['Date'];
          delete req.httpRequest.headers['X-Amz-Date'];

          signer.addAuthorization(credentials, date);
          req.signedAt = date;
        } catch (e) {
          req.response.error = e;
        }
        done();
      });
    });

    add('VALIDATE_RESPONSE', 'validateResponse', function VALIDATE_RESPONSE(resp) {
      if (this.service.successfulResponse(resp, this)) {
        resp.data = {};
        resp.error = null;
      } else {
        resp.data = null;
        resp.error = AWS.util.error(new Error(),
          {code: 'UnknownError', message: 'An unknown error occurred.'});
      }
    });

    addAsync('SEND', 'send', function SEND(resp, done) {
      resp.httpResponse._abortCallback = done;
      resp.error = null;
      resp.data = null;

      function callback(httpResp) {
        resp.httpResponse.stream = httpResp;

        httpResp.on('headers', function onHeaders(statusCode, headers) {
          resp.request.emit('httpHeaders', [statusCode, headers, resp]);

          if (!resp.httpResponse.streaming) {
            if (AWS.HttpClient.streamsApiVersion === 2) { // streams2 API check
              httpResp.on('readable', function onReadable() {
                var data = httpResp.read();
                if (data !== null) {
                  resp.request.emit('httpData', [data, resp]);
                }
              });
            } else { // legacy streams API
              httpResp.on('data', function onData(data) {
                resp.request.emit('httpData', [data, resp]);
              });
            }
          }
        });

        httpResp.on('end', function onEnd() {
          resp.request.emit('httpDone');
          done();
        });
      }

      function progress(httpResp) {
        httpResp.on('sendProgress', function onSendProgress(value) {
          resp.request.emit('httpUploadProgress', [value, resp]);
        });

        httpResp.on('receiveProgress', function onReceiveProgress(value) {
          resp.request.emit('httpDownloadProgress', [value, resp]);
        });
      }

      function error(err) {
        resp.error = AWS.util.error(err, {
          code: 'NetworkingError',
          region: resp.request.httpRequest.region,
          hostname: resp.request.httpRequest.endpoint.hostname,
          retryable: true
        });
        resp.request.emit('httpError', [resp.error, resp], function() {
          done();
        });
      }

      function executeSend() {
        var http = AWS.HttpClient.getInstance();
        var httpOptions = resp.request.service.config.httpOptions || {};
        try {
          var stream = http.handleRequest(resp.request.httpRequest, httpOptions,
                                          callback, error);
          progress(stream);
        } catch (err) {
          error(err);
        }
      }

      var timeDiff = (AWS.util.date.getDate() - this.signedAt) / 1000;
      if (timeDiff >= 60 * 10) { // if we signed 10min ago, re-sign
        this.emit('sign', [this], function(err) {
          if (err) done(err);
          else executeSend();
        });
      } else {
        executeSend();
      }
    });

    add('HTTP_HEADERS', 'httpHeaders',
        function HTTP_HEADERS(statusCode, headers, resp) {
      resp.httpResponse.statusCode = statusCode;
      resp.httpResponse.headers = headers;
      resp.httpResponse.body = new AWS.util.Buffer('');
      resp.httpResponse.buffers = [];
      resp.httpResponse.numBytes = 0;
    });

    add('HTTP_DATA', 'httpData', function HTTP_DATA(chunk, resp) {
      if (chunk) {
        if (AWS.util.isNode()) {
          resp.httpResponse.numBytes += chunk.length;

          var total = resp.httpResponse.headers['content-length'];
          var progress = { loaded: resp.httpResponse.numBytes, total: total };
          resp.request.emit('httpDownloadProgress', [progress, resp]);
        }

        resp.httpResponse.buffers.push(new AWS.util.Buffer(chunk));
      }
    });

    add('HTTP_DONE', 'httpDone', function HTTP_DONE(resp) {
      if (resp.httpResponse.buffers && resp.httpResponse.buffers.length > 0) {
        var body = AWS.util.buffer.concat(resp.httpResponse.buffers);
        resp.httpResponse.body = body;
      }
      delete resp.httpResponse.numBytes;
      delete resp.httpResponse.buffers;
    });

    add('FINALIZE_ERROR', 'retry', function FINALIZE_ERROR(resp) {
      if (resp.httpResponse.statusCode) {
        resp.error.statusCode = resp.httpResponse.statusCode;
        if (resp.error.retryable === undefined) {
          resp.error.retryable = this.service.retryableError(resp.error, this);
        }
      }
    });

    add('INVALIDATE_CREDENTIALS', 'retry', function INVALIDATE_CREDENTIALS(resp) {
      if (!resp.error) return;
      switch (resp.error.code) {
        case 'RequestExpired': // EC2 only
        case 'ExpiredTokenException':
        case 'ExpiredToken':
          resp.error.retryable = true;
          resp.request.service.config.credentials.expired = true;
      }
    });

    add('EXPIRED_SIGNATURE', 'retry', function EXPIRED_SIGNATURE(resp) {
      var err = resp.error;
      if (!err) return;
      if (typeof err.code === 'string' && typeof err.message === 'string') {
        if (err.code.match(/Signature/) && err.message.match(/expired/)) {
          resp.error.retryable = true;
        }
      }
    });

    add('REDIRECT', 'retry', function REDIRECT(resp) {
      if (resp.error && resp.error.statusCode >= 300 &&
          resp.error.statusCode < 400 && resp.httpResponse.headers['location']) {
        this.httpRequest.endpoint =
          new AWS.Endpoint(resp.httpResponse.headers['location']);
        this.httpRequest.headers['Host'] = this.httpRequest.endpoint.host;
        resp.error.redirect = true;
        resp.error.retryable = true;
      }
    });

    add('RETRY_CHECK', 'retry', function RETRY_CHECK(resp) {
      if (resp.error) {
        if (resp.error.redirect && resp.redirectCount < resp.maxRedirects) {
          resp.error.retryDelay = 0;
        } else if (resp.retryCount < resp.maxRetries) {
          var delays = this.service.retryDelays();
          resp.error.retryDelay = delays[resp.retryCount] || 0;
        }
      }
    });

    addAsync('RESET_RETRY_STATE', 'afterRetry', function RESET_RETRY_STATE(resp, done) {
      var delay, willRetry = false;

      if (resp.error) {
        delay = resp.error.retryDelay || 0;
        if (resp.error.retryable && resp.retryCount < resp.maxRetries) {
          resp.retryCount++;
          willRetry = true;
        } else if (resp.error.redirect && resp.redirectCount < resp.maxRedirects) {
          resp.redirectCount++;
          willRetry = true;
        }
      }

      if (willRetry) {
        resp.error = null;
        setTimeout(done, delay);
      } else {
        done();
      }
    });
  }),

  CorePost: new SequentialExecutor().addNamedListeners(function(add) {
    add('EXTRACT_REQUEST_ID', 'extractData', function EXTRACT_REQUEST_ID(resp) {

      if (!resp.requestId) {
        resp.requestId = resp.httpResponse.headers['x-amz-request-id'] ||
                          resp.httpResponse.headers['x-amzn-requestid'];
      }

      if (!resp.requestId && resp.data && resp.data.ResponseMetadata) {
        resp.requestId = resp.data.ResponseMetadata.RequestId;
      }
    });

    add('ENOTFOUND_ERROR', 'httpError', function ENOTFOUND_ERROR(err) {
      if (err.code === 'NetworkingError' && err.errno === 'ENOTFOUND') {
        var message = 'Inaccessible host: `' + err.hostname +
          '\'. This service may not be available in the `' + err.region +
          '\' region.';
        this.response.error = AWS.util.error(new Error(message), {
          code: 'UnknownEndpoint',
          region: err.region,
          hostname: err.hostname,
          retryable: true,
          originalError: err
        });
      }
    });
  }),

  Logger: new SequentialExecutor().addNamedListeners(function(add) {
    add('LOG_REQUEST', 'complete', function LOG_REQUEST(resp) {
      var req = resp.request;
      var logger = req.service.config.logger;
      if (!logger) return;

      function buildMessage() {
        var time = AWS.util.date.getDate().getTime();
        var delta = (time - req.startTime.getTime()) / 1000;
        var ansi = logger.isTTY ? true : false;
        var status = resp.httpResponse.statusCode;
        var params = require('util').inspect(req.params, true, null);

        var message = '';
        if (ansi) message += '\x1B[33m';
        message += '[AWS ' + req.service.serviceIdentifier + ' ' + status;
        message += ' ' + delta.toString() + 's ' + resp.retryCount + ' retries]';
        if (ansi) message += '\x1B[0;1m';
        message += ' ' + AWS.util.string.lowerFirst(req.operation);
        message += '(' + params + ')';
        if (ansi) message += '\x1B[0m';
        return message;
      }

      var line = buildMessage();
      if (typeof logger.log === 'function') {
        logger.log(line);
      } else if (typeof logger.write === 'function') {
        logger.write(line + '\n');
      }
    });
  }),

  Json: new SequentialExecutor().addNamedListeners(function(add) {
    var svc = require('./protocol/json');
    add('BUILD', 'build', svc.buildRequest);
    add('EXTRACT_DATA', 'extractData', svc.extractData);
    add('EXTRACT_ERROR', 'extractError', svc.extractError);
  }),

  Rest: new SequentialExecutor().addNamedListeners(function(add) {
    var svc = require('./protocol/rest');
    add('BUILD', 'build', svc.buildRequest);
    add('EXTRACT_DATA', 'extractData', svc.extractData);
    add('EXTRACT_ERROR', 'extractError', svc.extractError);
  }),

  RestJson: new SequentialExecutor().addNamedListeners(function(add) {
    var svc = require('./protocol/rest_json');
    add('BUILD', 'build', svc.buildRequest);
    add('EXTRACT_DATA', 'extractData', svc.extractData);
    add('EXTRACT_ERROR', 'extractError', svc.extractError);
  }),

  RestXml: new SequentialExecutor().addNamedListeners(function(add) {
    var svc = require('./protocol/rest_xml');
    add('BUILD', 'build', svc.buildRequest);
    add('EXTRACT_DATA', 'extractData', svc.extractData);
    add('EXTRACT_ERROR', 'extractError', svc.extractError);
  }),

  Query: new SequentialExecutor().addNamedListeners(function(add) {
    var svc = require('./protocol/query');
    add('BUILD', 'build', svc.buildRequest);
    add('EXTRACT_DATA', 'extractData', svc.extractData);
    add('EXTRACT_ERROR', 'extractError', svc.extractError);
  })
};

},{"./core":3,"./protocol/json":22,"./protocol/query":23,"./protocol/rest":24,"./protocol/rest_json":25,"./protocol/rest_xml":26,"./sequential_executor":34,"util":72}],11:[function(require,module,exports){
var AWS = require('./core');
var inherit = AWS.util.inherit;


AWS.Endpoint = inherit({


  constructor: function Endpoint(endpoint, config) {
    AWS.util.hideProperties(this, ['slashes', 'auth', 'hash', 'search', 'query']);

    if (typeof endpoint === 'undefined' || endpoint === null) {
      throw new Error('Invalid endpoint: ' + endpoint);
    } else if (typeof endpoint !== 'string') {
      return AWS.util.copy(endpoint);
    }

    if (!endpoint.match(/^http/)) {
      var useSSL = config && config.sslEnabled !== undefined ?
        config.sslEnabled : AWS.config.sslEnabled;
      endpoint = (useSSL ? 'https' : 'http') + '://' + endpoint;
    }

    AWS.util.update(this, AWS.util.urlParse(endpoint));

    if (this.port) {
      this.port = parseInt(this.port, 10);
    } else {
      this.port = this.protocol === 'https:' ? 443 : 80;
    }
  }

});


AWS.HttpRequest = inherit({


  constructor: function HttpRequest(endpoint, region) {
    endpoint = new AWS.Endpoint(endpoint);
    this.method = 'POST';
    this.path = endpoint.path || '/';
    this.headers = {};
    this.body = '';
    this.endpoint = endpoint;
    this.region = region;
    this.setUserAgent();
  },


  setUserAgent: function setUserAgent() {
    var prefix = AWS.util.isBrowser() ? 'X-Amz-' : '';
    this.headers[prefix + 'User-Agent'] = AWS.util.userAgent();
  },


  pathname: function pathname() {
    return this.path.split('?', 1)[0];
  },


  search: function search() {
    var query = this.path.split('?', 2)[1];
    if (query) {
      query = AWS.util.queryStringParse(query);
      return AWS.util.queryParamsToString(query);
    }
    return '';
  }

});


AWS.HttpResponse = inherit({


  constructor: function HttpResponse() {
    this.statusCode = undefined;
    this.headers = {};
    this.body = undefined;
    this.streaming = false;
    this.stream = null;
  },


  createUnbufferedStream: function createUnbufferedStream() {
    this.streaming = true;
    return this.stream;
  }
});


AWS.HttpClient = inherit({});


AWS.HttpClient.getInstance = function getInstance() {
  if (this.singleton === undefined) {
    this.singleton = new this();
  }
  return this.singleton;
};

},{"./core":3}],12:[function(require,module,exports){
var AWS = require('../core');
var EventEmitter = require('events').EventEmitter;
require('../http');


AWS.XHRClient = AWS.util.inherit({
  handleRequest: function handleRequest(httpRequest, httpOptions, callback, errCallback) {
    var self = this;
    var endpoint = httpRequest.endpoint;
    var emitter = new EventEmitter();
    var href = endpoint.protocol + '//' + endpoint.hostname;
    if (endpoint.port !== 80 && endpoint.port !== 443) {
      href += ':' + endpoint.port;
    }
    href += httpRequest.path;

    var xhr = new XMLHttpRequest(), headersEmitted = false;
    httpRequest.stream = xhr;

    xhr.addEventListener('readystatechange', function() {
      try {
        if (xhr.status === 0) return; // 0 code is invalid
      } catch (e) { return; }

      if (this.readyState >= this.HEADERS_RECEIVED && !headersEmitted) {
        try { xhr.responseType = 'arraybuffer'; } catch (e) {}
        emitter.statusCode = xhr.status;
        emitter.headers = self.parseHeaders(xhr.getAllResponseHeaders());
        emitter.emit('headers', emitter.statusCode, emitter.headers);
        headersEmitted = true;
      }
      if (this.readyState === this.DONE) {
        self.finishRequest(xhr, emitter);
      }
    }, false);
    xhr.upload.addEventListener('progress', function (evt) {
      emitter.emit('sendProgress', evt);
    });
    xhr.addEventListener('progress', function (evt) {
      emitter.emit('receiveProgress', evt);
    }, false);
    xhr.addEventListener('timeout', function () {
      errCallback(AWS.util.error(new Error('Timeout'), {code: 'TimeoutError'}));
    }, false);
    xhr.addEventListener('error', function () {
      errCallback(AWS.util.error(new Error('Network Failure'), {
        code: 'NetworkingError'
      }));
    }, false);

    callback(emitter);
    xhr.open(httpRequest.method, href, httpOptions.xhrAsync !== false);
    AWS.util.each(httpRequest.headers, function (key, value) {
      if (key !== 'Content-Length' && key !== 'User-Agent' && key !== 'Host') {
        xhr.setRequestHeader(key, value);
      }
    });

    if (httpOptions.timeout && httpOptions.xhrAsync !== false) {
      xhr.timeout = httpOptions.timeout;
    }

    if (httpOptions.xhrWithCredentials) {
      xhr.withCredentials = true;
    }

    try {
      xhr.send(httpRequest.body);
    } catch (err) {
      if (httpRequest.body && typeof httpRequest.body.buffer === 'object') {
        xhr.send(httpRequest.body.buffer); // send ArrayBuffer directly
      } else {
        throw err;
      }
    }

    return emitter;
  },

  parseHeaders: function parseHeaders(rawHeaders) {
    var headers = {};
    AWS.util.arrayEach(rawHeaders.split(/\r?\n/), function (line) {
      var key = line.split(':', 1)[0];
      var value = line.substring(key.length + 2);
      if (key.length > 0) headers[key.toLowerCase()] = value;
    });
    return headers;
  },

  finishRequest: function finishRequest(xhr, emitter) {
    var buffer;
    if (xhr.responseType === 'arraybuffer' && xhr.response) {
      var ab = xhr.response;
      buffer = new AWS.util.Buffer(ab.byteLength);
      var view = new Uint8Array(ab);
      for (var i = 0; i < buffer.length; ++i) {
        buffer[i] = view[i];
      }
    }

    try {
      if (!buffer && typeof xhr.responseText === 'string') {
        buffer = new AWS.util.Buffer(xhr.responseText);
      }
    } catch (e) {}

    if (buffer) emitter.emit('data', buffer);
    emitter.emit('end');
  }
});


AWS.HttpClient.prototype = AWS.XHRClient.prototype;


AWS.HttpClient.streamsApiVersion = 1;

},{"../core":3,"../http":11,"events":63}],13:[function(require,module,exports){
var util = require('../util');

function JsonBuilder() { }

JsonBuilder.prototype.build = function(value, shape) {
  return JSON.stringify(translate(value, shape));
};

function translate(value, shape) {
  if (!shape || value === undefined || value === null) return undefined;

  switch (shape.type) {
    case 'structure': return translateStructure(value, shape);
    case 'map': return translateMap(value, shape);
    case 'list': return translateList(value, shape);
    default: return translateScalar(value, shape);
  }
}

function translateStructure(structure, shape) {
  var struct = {};
  util.each(structure, function(name, value) {
    var memberShape = shape.members[name];
    if (memberShape) {
      if (memberShape.location !== 'body') return;

      var result = translate(value, memberShape);
      if (result !== undefined) struct[name] = result;
    }
  });
  return struct;
}

function translateList(list, shape) {
  var out = [];
  util.arrayEach(list, function(value) {
    var result = translate(value, shape.member);
    if (result !== undefined) out.push(result);
  });
  return out;
}

function translateMap(map, shape) {
  var out = {};
  util.each(map, function(key, value) {
    var result = translate(value, shape.value);
    if (result !== undefined) out[key] = result;
  });
  return out;
}

function translateScalar(value, shape) {
  return shape.toWireFormat(value);
}

module.exports = JsonBuilder;

},{"../util":51}],14:[function(require,module,exports){
var util = require('../util');

function JsonParser() { }

JsonParser.prototype.parse = function(value, shape) {
  return translate(JSON.parse(value), shape);
};

function translate(value, shape) {
  if (!shape || value === undefined) return undefined;

  switch (shape.type) {
    case 'structure': return translateStructure(value, shape);
    case 'map': return translateMap(value, shape);
    case 'list': return translateList(value, shape);
    default: return translateScalar(value, shape);
  }
}

function translateStructure(structure, shape) {
  if (structure == null) return undefined;

  var struct = {};
  util.each(structure, function(name, value) {
    var memberShape = shape.members[name];
    if (memberShape) {
      var result = translate(value, memberShape);
      if (result !== undefined) struct[name] = result;
    }
  });
  return struct;
}

function translateList(list, shape) {
  if (list == null) return undefined;

  var out = [];
  util.arrayEach(list, function(value) {
    var result = translate(value, shape.member);
    if (result === undefined) out.push(null);
    else out.push(result);
  });
  return out;
}

function translateMap(map, shape) {
  if (map == null) return undefined;

  var out = {};
  util.each(map, function(key, value) {
    var result = translate(value, shape.value);
    if (result === undefined) out[key] = null;
    else out[key] = result;
  });
  return out;
}

function translateScalar(value, shape) {
  return shape.toType(value);
}

module.exports = JsonParser;

},{"../util":51}],15:[function(require,module,exports){
var Collection = require('./collection');
var Operation = require('./operation');
var Shape = require('./shape');
var Paginator = require('./paginator');
var ResourceWaiter = require('./resource_waiter');

var util = require('../util');
var property = util.property;
var memoizedProperty = util.memoizedProperty;

function Api(api, options) {
  api = api || {};
  options = options || {};
  options.api = this;

  api.metadata = api.metadata || {};

  property(this, 'isApi', true, false);
  property(this, 'apiVersion', api.metadata.apiVersion);
  property(this, 'endpointPrefix', api.metadata.endpointPrefix);
  property(this, 'signingName', api.metadata.signingName);
  property(this, 'globalEndpoint', api.metadata.globalEndpoint);
  property(this, 'signatureVersion', api.metadata.signatureVersion);
  property(this, 'jsonVersion', api.metadata.jsonVersion);
  property(this, 'targetPrefix', api.metadata.targetPrefix);
  property(this, 'protocol', api.metadata.protocol);
  property(this, 'timestampFormat', api.metadata.timestampFormat);
  property(this, 'xmlNamespaceUri', api.metadata.xmlNamespace);
  property(this, 'abbreviation', api.metadata.serviceAbbreviation);
  property(this, 'fullName', api.metadata.serviceFullName);

  memoizedProperty(this, 'className', function() {
    var name = api.metadata.serviceAbbreviation || api.metadata.serviceFullName;
    if (!name) return null;

    name = name.replace(/^Amazon|AWS\s*|\(.*|\s+|\W+/g, '');
    if (name === 'ElasticLoadBalancing') name = 'ELB';
    return name;
  });

  property(this, 'operations', new Collection(api.operations, options, function(name, operation) {
    return new Operation(name, operation, options);
  }, util.string.lowerFirst));

  property(this, 'shapes', new Collection(api.shapes, options, function(name, shape) {
    return Shape.create(shape, options);
  }));

  property(this, 'paginators', new Collection(api.paginators, options, function(name, paginator) {
    return new Paginator(name, paginator, options);
  }));

  property(this, 'waiters', new Collection(api.waiters, options, function(name, waiter) {
    return new ResourceWaiter(name, waiter, options);
  }, util.string.lowerFirst));

  if (options.documentation) {
    property(this, 'documentation', api.documentation);
    property(this, 'documentationUrl', api.documentationUrl);
  }
}

module.exports = Api;

},{"../util":51,"./collection":16,"./operation":17,"./paginator":18,"./resource_waiter":19,"./shape":20}],16:[function(require,module,exports){
var memoizedProperty = require('../util').memoizedProperty;

function memoize(name, value, fn, nameTr) {
  memoizedProperty(this, nameTr(name), function() {
    return fn(name, value);
  });
}

function Collection(iterable, options, fn, nameTr) {
  nameTr = nameTr || String;
  var self = this;

  for (var id in iterable) {
    if (iterable.hasOwnProperty(id)) {
      memoize.call(self, id, iterable[id], fn, nameTr);
    }
  }
}

module.exports = Collection;

},{"../util":51}],17:[function(require,module,exports){
var Shape = require('./shape');

var util = require('../util');
var property = util.property;
var memoizedProperty = util.memoizedProperty;

function Operation(name, operation, options) {
  options = options || {};

  property(this, 'name', operation.name || name);
  property(this, 'api', options.api, false);

  operation.http = operation.http || {};
  property(this, 'httpMethod', operation.http.method || 'POST');
  property(this, 'httpPath', operation.http.requestUri || '/');

  memoizedProperty(this, 'input', function() {
    if (!operation.input) {
      return new Shape.create({type: 'structure'}, options);
    }
    return Shape.create(operation.input, options);
  });

  memoizedProperty(this, 'output', function() {
    if (!operation.output) {
      return new Shape.create({type: 'structure'}, options);
    }
    return Shape.create(operation.output, options);
  });

  memoizedProperty(this, 'errors', function() {
    var list = [];
    if (!operation.errors) return null;

    for (var i = 0; i < operation.errors.length; i++) {
      list.push(Shape.create(operation.errors[i], options));
    }

    return list;
  });

  memoizedProperty(this, 'paginator', function() {
    return options.api.paginators[name];
  });

  if (options.documentation) {
    property(this, 'documentation', operation.documentation);
    property(this, 'documentationUrl', operation.documentationUrl);
  }
}

module.exports = Operation;

},{"../util":51,"./shape":20}],18:[function(require,module,exports){
var property = require('../util').property;

function Paginator(name, paginator) {
  property(this, 'inputToken', paginator.input_token);
  property(this, 'limitKey', paginator.limit_key);
  property(this, 'moreResults', paginator.more_results);
  property(this, 'outputToken', paginator.output_token);
  property(this, 'resultKey', paginator.result_key);
}

module.exports = Paginator;

},{"../util":51}],19:[function(require,module,exports){
var util = require('../util');
var property = util.property;

function ResourceWaiter(name, waiter, options) {
  options = options || {};

  function InnerResourceWaiter() {
    property(this, 'name', name);
    property(this, 'api', options.api, false);

    if (waiter.operation) {
      property(this, 'operation', util.string.lowerFirst(waiter.operation));
    }

    var self = this, map = {
      ignoreErrors: 'ignore_errors',
      successType: 'success_type',
      successValue: 'success_value',
      successPath: 'success_path',
      acceptorType: 'acceptor_type',
      acceptorValue: 'acceptor_value',
      acceptorPath: 'acceptor_path',
      failureType: 'failure_type',
      failureValue: 'failure_value',
      failurePath: 'success_path',
      interval: 'interval',
      maxAttempts: 'max_attempts'
    };
    Object.keys(map).forEach(function(key) {
      var value = waiter[map[key]];
      if (value) property(self, key, value);
    });
  }

  if (options.api) {
    var proto = null;
    if (waiter['extends']) {
      proto = options.api.waiters[waiter['extends']];
    } else if (name !== '__default__') {
      proto = options.api.waiters['__default__'];
    }

    if (proto) InnerResourceWaiter.prototype = proto;
  }

  return new InnerResourceWaiter();
}

module.exports = ResourceWaiter;

},{"../util":51}],20:[function(require,module,exports){
var Collection = require('./collection');

var util = require('../util');

function property(obj, name, value) {
  if (value !== null && value !== undefined) {
    util.property.apply(this, arguments);
  }
}

function memoizedProperty(obj, name) {
  if (!obj.constructor.prototype[name]) {
    util.memoizedProperty.apply(this, arguments);
  }
}

function Shape(shape, options, memberName) {
  options = options || {};

  property(this, 'shape', shape.shape);
  property(this, 'api', options.api, false);
  property(this, 'type', shape.type);
  property(this, 'location', shape.location || this.location || 'body');
  property(this, 'name', this.name || shape.xmlName || shape.queryName ||
    shape.locationName || memberName);
  property(this, 'isStreaming', shape.streaming || this.isStreaming || false);
  property(this, 'isComposite', shape.isComposite || false);
  property(this, 'isShape', true, false);
  property(this, 'isQueryName', shape.queryName ? true : false, false);
  property(this, 'isLocationName', shape.locationName ? true : false, false);

  if (options.documentation) {
    property(this, 'documentation', shape.documentation);
    property(this, 'documentationUrl', shape.documentationUrl);
  }

  if (shape.xmlAttribute) {
    property(this, 'isXmlAttribute', shape.xmlAttribute || false);
  }

  property(this, 'defaultValue', null);
  this.toWireFormat = function(value) {
    if (value === null || value === undefined) return '';
    return value;
  };
  this.toType = function(value) { return value; };
}


Shape.normalizedTypes = {
  character: 'string',
  double: 'float',
  long: 'integer',
  short: 'integer',
  biginteger: 'integer',
  bigdecimal: 'float',
  blob: 'binary'
};


Shape.types = {
  'structure': StructureShape,
  'list': ListShape,
  'map': MapShape,
  'boolean': BooleanShape,
  'timestamp': TimestampShape,
  'float': FloatShape,
  'integer': IntegerShape,
  'string': StringShape,
  'base64': Base64Shape,
  'binary': BinaryShape
};

Shape.resolve = function resolve(shape, options) {
  if (shape.shape) {
    var refShape = options.api.shapes[shape.shape];
    if (!refShape) {
      throw new Error('Cannot find shape reference: ' + shape.shape);
    }

    return refShape;
  } else {
    return null;
  }
};

Shape.create = function create(shape, options, memberName) {
  if (shape.isShape) return shape;

  var refShape = Shape.resolve(shape, options);
  if (refShape) {
    var filteredKeys = Object.keys(shape);
    if (!options.documentation) {
      filteredKeys = filteredKeys.filter(function(name) {
        return !name.match(/documentation/);
      });
    }
    if (filteredKeys === ['shape']) { // no inline customizations
      return refShape;
    }

    var InlineShape = function() {
      refShape.constructor.call(this, shape, options, memberName);
    };
    InlineShape.prototype = refShape;
    return new InlineShape();
  } else {
    if (!shape.type) {
      if (shape.members) shape.type = 'structure';
      else if (shape.member) shape.type = 'list';
      else if (shape.key) shape.type = 'map';
      else shape.type = 'string';
    }

    var origType = shape.type;
    if (Shape.normalizedTypes[shape.type]) {
      shape.type = Shape.normalizedTypes[shape.type];
    }

    if (Shape.types[shape.type]) {
      return new Shape.types[shape.type](shape, options, memberName);
    } else {
      throw new Error('Unrecognized shape type: ' + origType);
    }
  }
};

function CompositeShape(shape) {
  Shape.apply(this, arguments);
  property(this, 'isComposite', true);

  if (shape.flattened) {
    property(this, 'flattened', shape.flattened || false);
  }
}

function StructureShape(shape, options) {
  var requiredMap = null, firstInit = !this.isShape;

  CompositeShape.apply(this, arguments);

  if (firstInit) {
    property(this, 'defaultValue', function() { return {}; });
    property(this, 'members', {});
    property(this, 'memberNames', []);
    property(this, 'required', []);
    property(this, 'isRequired', function() { return false; });
  }

  if (shape.members) {
    property(this, 'members', new Collection(shape.members, options, function(name, member) {
      return Shape.create(member, options, name);
    }));
    memoizedProperty(this, 'memberNames', function() {
      return shape.xmlOrder || Object.keys(shape.members);
    });
  }

  if (shape.required) {
    property(this, 'required', shape.required);
    property(this, 'isRequired', function(name) {
      if (!requiredMap) {
        requiredMap = {};
        for (var i = 0; i < shape.required.length; i++) {
          requiredMap[shape.required[i]] = true;
        }
      }

      return requiredMap[name];
    }, false, true);
  }

  property(this, 'resultWrapper', shape.resultWrapper || null);

  if (shape.payload) {
    property(this, 'payload', shape.payload);
  }

  if (typeof shape.xmlNamespace === 'string') {
    property(this, 'xmlNamespaceUri', shape.xmlNamespace);
  } else if (typeof shape.xmlNamespace === 'object') {
    property(this, 'xmlNamespacePrefix', shape.xmlNamespace.prefix);
    property(this, 'xmlNamespaceUri', shape.xmlNamespace.uri);
  }
}

function ListShape(shape, options) {
  var self = this, firstInit = !this.isShape;
  CompositeShape.apply(this, arguments);

  if (firstInit) {
    property(this, 'defaultValue', function() { return []; });
  }

  if (shape.member) {
    memoizedProperty(this, 'member', function() {
      return Shape.create(shape.member, options);
    });
  }

  if (this.flattened) {
    var oldName = this.name;
    memoizedProperty(this, 'name', function() {
      return self.member.name || oldName;
    });
  }
}

function MapShape(shape, options) {
  var firstInit = !this.isShape;
  CompositeShape.apply(this, arguments);

  if (firstInit) {
    property(this, 'defaultValue', function() { return {}; });
    property(this, 'key', Shape.create({type: 'string'}, options));
    property(this, 'value', Shape.create({type: 'string'}, options));
  }

  if (shape.key) {
    memoizedProperty(this, 'key', function() {
      return Shape.create(shape.key, options);
    });
  }
  if (shape.value) {
    memoizedProperty(this, 'value', function() {
      return Shape.create(shape.value, options);
    });
  }
}

function TimestampShape(shape) {
  var self = this;
  Shape.apply(this, arguments);

  if (this.location === 'header') {
    property(this, 'timestampFormat', 'rfc822');
  } else if (shape.timestampFormat) {
    property(this, 'timestampFormat', shape.timestampFormat);
  } else if (this.api) {
    if (this.api.timestampFormat) {
      property(this, 'timestampFormat', this.api.timestampFormat);
    } else {
      switch (this.api.protocol) {
        case 'json':
        case 'rest-json':
          property(this, 'timestampFormat', 'unixTimestamp');
          break;
        case 'rest-xml':
        case 'query':
        case 'ec2':
          property(this, 'timestampFormat', 'iso8601');
          break;
      }
    }
  }

  this.toType = function(value) {
    if (value === null || value === undefined) return null;
    if (typeof value.toUTCString === 'function') return value;
    return typeof value === 'string' || typeof value === 'number' ?
           util.date.parseTimestamp(value) : null;
  };

  this.toWireFormat = function(value) {
    return util.date.format(value, self.timestampFormat);
  };
}

function StringShape() {
  Shape.apply(this, arguments);

  if (this.api) {
    switch (this.api.protocol) {
      case 'rest-xml':
      case 'query':
      case 'ec2':
        this.toType = function(value) { return value || ''; };
    }
  }
}

function FloatShape() {
  Shape.apply(this, arguments);

  this.toType = function(value) {
    if (value === null || value === undefined) return null;
    return parseFloat(value);
  };
  this.toWireFormat = this.toType;
}

function IntegerShape() {
  Shape.apply(this, arguments);

  this.toType = function(value) {
    if (value === null || value === undefined) return null;
    return parseInt(value, 10);
  };
  this.toWireFormat = this.toType;
}

function BinaryShape() {
  Shape.apply(this, arguments);
  this.toType = util.base64.decode;
  this.toWireFormat = util.base64.encode;
}

function Base64Shape() {
  BinaryShape.apply(this, arguments);
}

function BooleanShape() {
  Shape.apply(this, arguments);

  this.toType = function(value) {
    if (typeof value === 'boolean') return value;
    if (value === null || value === undefined) return null;
    return value === 'true';
  };
}


Shape.shapes = {
  StructureShape: StructureShape,
  ListShape: ListShape,
  MapShape: MapShape,
  StringShape: StringShape,
  BooleanShape: BooleanShape,
  Base64Shape: Base64Shape
};

module.exports = Shape;

},{"../util":51,"./collection":16}],21:[function(require,module,exports){
var AWS = require('./core');


AWS.ParamValidator = AWS.util.inherit({
  validate: function validate(shape, params, context) {
    this.errors = [];
    this.validateMember(shape, params || {}, context || 'params');

    if (this.errors.length > 1) {
      var msg = this.errors.join('\n* ');
      if (this.errors.length > 1) {
        msg = 'There were ' + this.errors.length +
              ' validation errors:\n* ' + msg;
        throw AWS.util.error(new Error(msg),
          {code: 'MultipleValidationErrors', errors: this.errors});
      }
    } else if (this.errors.length === 1) {
      throw this.errors[0];
    } else {
      return true;
    }
  },

  validateStructure: function validateStructure(shape, params, context) {
    this.validateType(context, params, ['object'], 'structure');

    var paramName;
    for (var i = 0; shape.required && i < shape.required.length; i++) {
      paramName = shape.required[i];
      var value = params[paramName];
      if (value === undefined || value === null) {
        this.fail('MissingRequiredParameter',
          'Missing required key \'' + paramName + '\' in ' + context);
      }
    }

    for (paramName in params) {
      if (!params.hasOwnProperty(paramName)) continue;

      var paramValue = params[paramName],
          memberShape = shape.members[paramName];

      if (memberShape !== undefined) {
        var memberContext = [context, paramName].join('.');
        this.validateMember(memberShape, paramValue, memberContext);
      } else {
        this.fail('UnexpectedParameter',
          'Unexpected key \'' + paramName + '\' found in ' + context);
      }
    }

    return true;
  },

  validateMember: function validateMember(shape, param, context) {
    switch (shape.type) {
      case 'structure':
        return this.validateStructure(shape, param, context);
      case 'list':
        return this.validateList(shape, param, context);
      case 'map':
        return this.validateMap(shape, param, context);
      default:
        return this.validateScalar(shape, param, context);
    }
  },

  validateList: function validateList(shape, params, context) {
    this.validateType(context, params, [Array]);

    for (var i = 0; i < params.length; i++) {
      this.validateMember(shape.member, params[i], context + '[' + i + ']');
    }
  },

  validateMap: function validateMap(shape, params, context) {
    this.validateType(context, params, ['object'], 'map');

    for (var param in params) {
      if (!params.hasOwnProperty(param)) continue;
      this.validateMember(shape.value, params[param],
                          context + '[\'' + param + '\']');
    }
  },

  validateScalar: function validateScalar(shape, value, context) {
    switch (shape.type) {
      case null:
      case undefined:
      case 'string':
        return this.validateType(context, value, ['string']);
      case 'base64':
      case 'binary':
        return this.validatePayload(context, value);
      case 'integer':
      case 'float':
        return this.validateNumber(context, value);
      case 'boolean':
        return this.validateType(context, value, ['boolean']);
      case 'timestamp':
        return this.validateType(context, value, [Date,
          /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/, 'number'],
          'Date object, ISO-8601 string, or a UNIX timestamp');
      default:
        return this.fail('UnkownType', 'Unhandled type ' +
                         shape.type + ' for ' + context);
    }
  },

  fail: function fail(code, message) {
    this.errors.push(AWS.util.error(new Error(message), {code: code}));
  },

  validateType: function validateType(context, value, acceptedTypes, type) {
    if (value === null || value === undefined) return;

    var foundInvalidType = false;
    for (var i = 0; i < acceptedTypes.length; i++) {
      if (typeof acceptedTypes[i] === 'string') {
        if (typeof value === acceptedTypes[i]) return;
      } else if (acceptedTypes[i] instanceof RegExp) {
        if ((value || '').toString().match(acceptedTypes[i])) return;
      } else {
        if (value instanceof acceptedTypes[i]) return;
        if (AWS.util.isType(value, acceptedTypes[i])) return;
        if (!type && !foundInvalidType) acceptedTypes = acceptedTypes.slice();
        acceptedTypes[i] = AWS.util.typeName(acceptedTypes[i]);
      }
      foundInvalidType = true;
    }

    var acceptedType = type;
    if (!acceptedType) {
      acceptedType = acceptedTypes.join(', ').replace(/,([^,]+)$/, ', or$1');
    }

    var vowel = acceptedType.match(/^[aeiou]/i) ? 'n' : '';
    this.fail('InvalidParameterType', 'Expected ' + context + ' to be a' +
              vowel + ' ' + acceptedType);
  },

  validateNumber: function validateNumber(context, value) {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') {
      var castedValue = parseFloat(value);
      if (castedValue.toString() === value) value = castedValue;
    }
    this.validateType(context, value, ['number']);
  },

  validatePayload: function validatePayload(context, value) {
    if (value === null || value === undefined) return;
    if (typeof value === 'string') return;
    if (value && typeof value.byteLength === 'number') return; // typed arrays
    if (AWS.util.isNode()) { // special check for buffer/stream in Node.js
      var Stream = AWS.util.nodeRequire('stream').Stream;
      if (AWS.util.Buffer.isBuffer(value) || value instanceof Stream) return;
    }

    var types = ['Buffer', 'Stream', 'File', 'Blob', 'ArrayBuffer', 'DataView'];
    if (value) {
      for (var i = 0; i < types.length; i++) {
        if (AWS.util.isType(value, types[i])) return;
        if (AWS.util.typeName(value.constructor) === types[i]) return;
      }
    }

    this.fail('InvalidParameterType', 'Expected ' + context + ' to be a ' +
      'string, Buffer, Stream, Blob, or typed array object');
  }
});

},{"./core":3}],22:[function(require,module,exports){
var util = require('../util');
var JsonBuilder = require('../json/builder');
var JsonParser = require('../json/parser');

function buildRequest(req) {
  var httpRequest = req.httpRequest;
  var api = req.service.api;
  var target = api.targetPrefix + '.' + api.operations[req.operation].name;
  var version = api.jsonVersion || '1.0';
  var input = api.operations[req.operation].input;
  var builder = new JsonBuilder();

  if (version === 1) version = '1.0';
  httpRequest.body = builder.build(req.params || {}, input);
  httpRequest.headers['Content-Type'] = 'application/x-amz-json-' + version;
  httpRequest.headers['X-Amz-Target'] = target;
}

function extractError(resp) {
  var error = {};
  var httpResponse = resp.httpResponse;

  error.code = httpResponse.headers['x-amzn-errortype'] || 'UnknownError';
  if (typeof error.code === 'string') {
    error.code = error.code.split(':')[0];
  }

  if (httpResponse.body.length > 0) {
    var e = JSON.parse(httpResponse.body.toString());
    if (e.__type || e.code) {
      error.code = (e.__type || e.code).split('#').pop();
    }
    if (error.code === 'RequestEntityTooLarge') {
      error.message = 'Request body must be less than 1 MB';
    } else {
      error.message = (e.message || e.Message || null);
    }
  } else {
    error.statusCode = httpResponse.statusCode;
    error.message = httpResponse.statusCode.toString();
  }

  resp.error = util.error(new Error(), error);
}

function extractData(resp) {
  var body = resp.httpResponse.body.toString() || '{}';
  if (resp.request.service.config.convertResponseTypes === false) {
    resp.data = JSON.parse(body);
  } else {
    var operation = resp.request.service.api.operations[resp.request.operation];
    var shape = operation.output || {};
    var parser = new JsonParser();
    resp.data = parser.parse(body, shape);
  }
}

module.exports = {
  buildRequest: buildRequest,
  extractError: extractError,
  extractData: extractData
};

},{"../json/builder":13,"../json/parser":14,"../util":51}],23:[function(require,module,exports){
var AWS = require('../core');
var util = require('../util');
var QueryParamSerializer = require('../query/query_param_serializer');
var Shape = require('../model/shape');

function buildRequest(req) {
  var operation = req.service.api.operations[req.operation];
  var httpRequest = req.httpRequest;
  httpRequest.headers['Content-Type'] =
    'application/x-www-form-urlencoded; charset=utf-8';
  httpRequest.params = {
    Version: req.service.api.apiVersion,
    Action: operation.name
  };

  var builder = new QueryParamSerializer();
  builder.serialize(req.params, operation.input, function(name, value) {
    httpRequest.params[name] = value;
  });
  httpRequest.body = util.queryParamsToString(httpRequest.params);
}

function extractError(resp) {
  var data, body = resp.httpResponse.body.toString();
  if (body.match('<UnknownOperationException')) {
    data = {
      Code: 'UnknownOperation',
      Message: 'Unknown operation ' + resp.request.operation
    };
  } else {
    data = new AWS.XML.Parser().parse(body);
  }

  if (data.requestId && !resp.requestId) resp.requestId = data.requestId;
  if (data.Errors) data = data.Errors;
  if (data.Error) data = data.Error;
  if (data.Code) {
    resp.error = util.error(new Error(), {
      code: data.Code,
      message: data.Message
    });
  } else {
    resp.error = util.error(new Error(), {
      code: resp.httpResponse.statusCode,
      message: null
    });
  }
}

function extractData(resp) {
  var req = resp.request;
  var operation = req.service.api.operations[req.operation];
  var shape = operation.output || {};
  var origRules = shape;

  if (origRules.resultWrapper) {
    var tmp = Shape.create({type: 'structure'});
    tmp.members[origRules.resultWrapper] = shape;
    tmp.memberNames = [origRules.resultWrapper];
    util.property(shape, 'name', shape.resultWrapper);
    shape = tmp;
  }

  var parser = new AWS.XML.Parser();

  if (shape && shape.members && !shape.members._XAMZRequestId) {
    var requestIdShape = Shape.create(
      { type: 'string' },
      { api: { protocol: 'query' } },
      'requestId'
    );
    shape.members._XAMZRequestId = requestIdShape;
  }

  var data = parser.parse(resp.httpResponse.body.toString(), shape);
  resp.requestId = data._XAMZRequestId || data.requestId;

  if (data._XAMZRequestId) delete data._XAMZRequestId;

  if (origRules.resultWrapper) {
    if (data[origRules.resultWrapper]) {
      util.update(data, data[origRules.resultWrapper]);
      delete data[origRules.resultWrapper];
    }
  }

  resp.data = data;
}

module.exports = {
  buildRequest: buildRequest,
  extractError: extractError,
  extractData: extractData
};

},{"../core":3,"../model/shape":20,"../query/query_param_serializer":27,"../util":51}],24:[function(require,module,exports){
var util = require('../util');

function populateMethod(req) {
  req.httpRequest.method = req.service.api.operations[req.operation].httpMethod;
}

function populateURI(req) {
  var operation = req.service.api.operations[req.operation];
  var input = operation.input;
  var uri = [req.httpRequest.endpoint.path, operation.httpPath].join('/');
  uri = uri.replace(/\/+/g, '/');

  var queryString = {}, queryStringSet = false;
  util.each(input.members, function (name, member) {
    var paramValue = req.params[name];
    if (paramValue === null || paramValue === undefined) return;
    if (member.location === 'uri') {
      var regex = new RegExp('\\{' + member.name + '(\\+)?\\}');
      uri = uri.replace(regex, function(_, plus) {
        var fn = plus ? util.uriEscapePath : util.uriEscape;
        return fn(String(paramValue));
      });
    } else if (member.location === 'querystring') {
      queryStringSet = true;

      if (member.type === 'list') {
        queryString[member.name] = paramValue.map(function(val) {
          return util.uriEscape(String(val));
        });
      } else {
        queryString[member.name] = util.uriEscape(String(paramValue));
      }
    }
  });

  if (queryStringSet) {
    uri += (uri.indexOf('?') >= 0 ? '&' : '?');
    var parts = [];
    util.arrayEach(Object.keys(queryString).sort(), function(key) {
      if (!Array.isArray(queryString[key])) {
        queryString[key] = [queryString[key]];
      }
      for (var i = 0; i < queryString[key].length; i++) {
        parts.push(util.uriEscape(String(key)) + '=' + queryString[key][i]);
      }
    });
    uri += parts.join('&');
  }

  req.httpRequest.path = uri;
}

function populateHeaders(req) {
  var operation = req.service.api.operations[req.operation];
  util.each(operation.input.members, function (name, member) {
    var value = req.params[name];
    if (value === null || value === undefined) return;

    if (member.location === 'headers' && member.type === 'map') {
      util.each(value, function(key, memberValue) {
        req.httpRequest.headers[member.name + key] = memberValue;
      });
    } else if (member.location === 'header') {
      value = member.toWireFormat(value).toString();
      req.httpRequest.headers[member.name] = value;
    }
  });
}

function buildRequest(req) {
  populateMethod(req);
  populateURI(req);
  populateHeaders(req);
}

function extractError() {
}

function extractData(resp) {
  var req = resp.request;
  var data = {};
  var r = resp.httpResponse;
  var operation = req.service.api.operations[req.operation];
  var output = operation.output;

  var headers = {};
  util.each(r.headers, function (k, v) {
    headers[k.toLowerCase()] = v;
  });

  util.each(output.members, function(name, member) {
    var header = (member.name || name).toLowerCase();
    if (member.location === 'headers' && member.type === 'map') {
      data[name] = {};
      var location = member.isLocationName ? member.name : '';
      var pattern = new RegExp('^' + location + '(.+)', 'i');
      util.each(r.headers, function (k, v) {
        var result = k.match(pattern);
        if (result !== null) {
          data[name][result[1]] = v;
        }
      });
    } else if (member.location === 'header') {
      if (headers[header] !== undefined) {
        data[name] = headers[header];
      }
    } else if (member.location === 'statusCode') {
      data[name] = parseInt(r.statusCode, 10);
    }
  });

  resp.data = data;
}

module.exports = {
  buildRequest: buildRequest,
  extractError: extractError,
  extractData: extractData
};

},{"../util":51}],25:[function(require,module,exports){
var util = require('../util');
var Rest = require('./rest');
var Json = require('./json');
var JsonBuilder = require('../json/builder');
var JsonParser = require('../json/parser');

function populateBody(req) {
  var builder = new JsonBuilder();
  var input = req.service.api.operations[req.operation].input;

  if (input.payload) {
    var params = {};
    var payloadShape = input.members[input.payload];
    params = req.params[input.payload];
    if (params === undefined) return;

    if (payloadShape.type === 'structure') {
      req.httpRequest.body = builder.build(params, payloadShape);
    } else { // non-JSON payload
      req.httpRequest.body = params;
    }
  } else {
    req.httpRequest.body = builder.build(req.params, input);
  }
}

function buildRequest(req) {
  Rest.buildRequest(req);

  if (['GET', 'HEAD'].indexOf(req.httpRequest.method) < 0) {
    populateBody(req);
  }
}

function extractError(resp) {
  Json.extractError(resp);
}

function extractData(resp) {
  Rest.extractData(resp);

  var req = resp.request;
  var rules = req.service.api.operations[req.operation].output || {};
  if (rules.payload) {
    var payloadMember = rules.members[rules.payload];
    var body = resp.httpResponse.body;
    if (payloadMember.isStreaming) {
      resp.data[rules.payload] = body;
    } else if (payloadMember.type === 'structure') {
      var parser = new JsonParser();
      resp.data[rules.payload] = parser.parse(body, payloadMember);
    } else {
      resp.data[rules.payload] = body.toString();
    }
  } else {
    var data = resp.data;
    Json.extractData(resp);
    resp.data = util.merge(data, resp.data);
  }
}

module.exports = {
  buildRequest: buildRequest,
  extractError: extractError,
  extractData: extractData
};

},{"../json/builder":13,"../json/parser":14,"../util":51,"./json":22,"./rest":24}],26:[function(require,module,exports){
var AWS = require('../core');
var util = require('../util');
var Rest = require('./rest');

function populateBody(req) {
  var input = req.service.api.operations[req.operation].input;
  var builder = new AWS.XML.Builder();
  var params = req.params;

  var payload = input.payload;
  if (payload) {
    var payloadMember = input.members[payload];
    params = params[payload];
    if (params === undefined) return;

    if (payloadMember.type === 'structure') {
      var rootElement = payloadMember.name;
      req.httpRequest.body = builder.toXML(params, payloadMember, rootElement, true);
    } else { // non-xml payload
      req.httpRequest.body = params;
    }
  } else {
    req.httpRequest.body = builder.toXML(params, input, input.name ||
      input.shape || util.string.upperFirst(req.operation) + 'Request');
  }
}

function buildRequest(req) {
  Rest.buildRequest(req);

  if (['GET', 'HEAD'].indexOf(req.httpRequest.method) < 0) {
    populateBody(req);
  }
}

function extractError(resp) {
  Rest.extractError(resp);

  var data = new AWS.XML.Parser().parse(resp.httpResponse.body.toString());
  if (data.Errors) data = data.Errors;
  if (data.Error) data = data.Error;
  if (data.Code) {
    resp.error = util.error(new Error(), {
      code: data.Code,
      message: data.Message
    });
  } else {
    resp.error = util.error(new Error(), {
      code: resp.httpResponse.statusCode,
      message: null
    });
  }
}

function extractData(resp) {
  Rest.extractData(resp);

  var parser;
  var req = resp.request;
  var body = resp.httpResponse.body;
  var operation = req.service.api.operations[req.operation];
  var output = operation.output;

  var payload = output.payload;
  if (payload) {
    var payloadMember = output.members[payload];
    if (payloadMember.isStreaming) {
      resp.data[payload] = body;
    } else if (payloadMember.type === 'structure') {
      parser = new AWS.XML.Parser();
      resp.data[payload] = parser.parse(body.toString(), payloadMember);
    } else {
      resp.data[payload] = body.toString();
    }
  } else if (body.length > 0) {
    parser = new AWS.XML.Parser();
    var data = parser.parse(body.toString(), output);
    util.update(resp.data, data);
  }
}

module.exports = {
  buildRequest: buildRequest,
  extractError: extractError,
  extractData: extractData
};

},{"../core":3,"../util":51,"./rest":24}],27:[function(require,module,exports){
var util = require('../util');

function QueryParamSerializer() {
}

QueryParamSerializer.prototype.serialize = function(params, shape, fn) {
  serializeStructure('', params, shape, fn);
};

function ucfirst(shape) {
  if (shape.isQueryName || shape.api.protocol !== 'ec2') {
    return shape.name;
  } else {
    return shape.name[0].toUpperCase() + shape.name.substr(1);
  }
}

function serializeStructure(prefix, struct, rules, fn) {
  util.each(rules.members, function(name, member) {
    var value = struct[name];
    if (value === null || value === undefined) return;

    var memberName = ucfirst(member);
    memberName = prefix ? prefix + '.' + memberName : memberName;
    serializeMember(memberName, value, member, fn);
  });
}

function serializeMap(name, map, rules, fn) {
  var i = 1;
  util.each(map, function (key, value) {
    var prefix = rules.flattened ? '.' : '.entry.';
    var position = prefix + (i++) + '.';
    var keyName = position + (rules.key.name || 'key');
    var valueName = position + (rules.value.name || 'value');
    serializeMember(name + keyName, key, rules.key, fn);
    serializeMember(name + valueName, value, rules.value, fn);
  });
}

function serializeList(name, list, rules, fn) {
  var memberRules = rules.member || {};

  if (list.length === 0) {
    fn.call(this, name, null);
    return;
  }

  util.arrayEach(list, function (v, n) {
    var suffix = '.' + (n + 1);
    if (rules.api.protocol === 'ec2') {
      suffix = suffix + ''; // make linter happy
    } else if (rules.flattened) {
      if (memberRules.name) {
        var parts = name.split('.');
        parts.pop();
        parts.push(ucfirst(memberRules));
        name = parts.join('.');
      }
    } else {
      suffix = '.member' + suffix;
    }
    serializeMember(name + suffix, v, memberRules, fn);
  });
}

function serializeMember(name, value, rules, fn) {
  if (value === null || value === undefined) return;
  if (rules.type === 'structure') {
    serializeStructure(name, value, rules, fn);
  } else if (rules.type === 'list') {
    serializeList(name, value, rules, fn);
  } else if (rules.type === 'map') {
    serializeMap(name, value, rules, fn);
  } else {
    fn(name, rules.toWireFormat(value).toString());
  }
}

module.exports = QueryParamSerializer;

},{"../util":51}],28:[function(require,module,exports){
var util = require('./util');
var regionConfig = require('./region_config.json');

function generateRegionPrefix(region) {
  if (!region) return null;

  var parts = region.split('-');
  if (parts.length < 3) return null;
  return parts.slice(0, parts.length - 2).join('-') + '-*';
}

function derivedKeys(service) {
  var region = service.config.region;
  var regionPrefix = generateRegionPrefix(region);
  var endpointPrefix = service.api.endpointPrefix;

  return [
    [region, endpointPrefix],
    [regionPrefix, endpointPrefix],
    [region, '*'],
    [regionPrefix, '*'],
    ['*', endpointPrefix],
    ['*', '*']
  ].map(function(item) {
    return item[0] && item[1] ? item.join('/') : null;
  });
}

function applyConfig(service, config) {
  util.each(config, function(key, value) {
    if (key === 'globalEndpoint') return;
    if (service.config[key] === undefined || service.config[key] === null) {
      service.config[key] = value;
    }
  });
}

function configureEndpoint(service) {
  var keys = derivedKeys(service);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    if (!key) continue;

    if (regionConfig.rules.hasOwnProperty(key)) {
      var config = regionConfig.rules[key];
      if (typeof config === 'string') {
        config = regionConfig.patterns[config];
      }

      service.isGlobalEndpoint = !!config.globalEndpoint;

      if (!config.signatureVersion) config.signatureVersion = 'v4';

      applyConfig(service, config);
      return;
    }
  }
}

module.exports = configureEndpoint;

},{"./region_config.json":29,"./util":51}],29:[function(require,module,exports){
module.exports={
  "rules": {
    "*/*": {
      "endpoint": "{service}.{region}.amazonaws.com"
    },
    "cn-*/*": {
      "endpoint": "{service}.{region}.amazonaws.com.cn"
    },
    "*/cloudfront": "globalSSL",
    "*/iam": "globalSSL",
    "*/sts": "globalSSL",
    "*/importexport": {
      "endpoint": "{service}.amazonaws.com",
      "signatureVersion": "v2",
      "globalEndpoint": true
    },
    "*/route53": {
      "endpoint": "https://{service}.amazonaws.com",
      "signatureVersion": "v3https",
      "globalEndpoint": true
    },
    "us-gov-*/iam": "globalGovCloud",
    "us-gov-*/sts": {
      "endpoint": "{service}.{region}.amazonaws.com"
    },
    "us-gov-west-1/s3": "s3dash",
    "us-west-1/s3": "s3dash",
    "us-west-2/s3": "s3dash",
    "eu-west-1/s3": "s3dash",
    "ap-southeast-1/s3": "s3dash",
    "ap-southeast-2/s3": "s3dash",
    "ap-northeast-1/s3": "s3dash",
    "sa-east-1/s3": "s3dash",
    "us-east-1/s3": {
      "endpoint": "{service}.amazonaws.com",
      "signatureVersion": "s3"
    },
    "us-east-1/sdb": {
      "endpoint": "{service}.amazonaws.com",
      "signatureVersion": "v2"
    },
    "*/sdb": {
      "endpoint": "{service}.{region}.amazonaws.com",
      "signatureVersion": "v2"
    }
  },

  "patterns": {
    "globalSSL": {
      "endpoint": "https://{service}.amazonaws.com",
      "globalEndpoint": true
    },
    "globalGovCloud": {
      "endpoint": "{service}.us-gov.amazonaws.com"
    },
    "s3dash": {
      "endpoint": "{service}-{region}.amazonaws.com",
      "signatureVersion": "s3"
    }
  }
}

},{}],30:[function(require,module,exports){
(function (process){
var AWS = require('./core');
var AcceptorStateMachine = require('./state_machine');
var inherit = AWS.util.inherit;
var domain = AWS.util.nodeRequire('domain');


var hardErrorStates = {success: 1, error: 1, complete: 1};

function isTerminalState(machine) {
  return hardErrorStates.hasOwnProperty(machine._asm.currentState);
}

var fsm = new AcceptorStateMachine();
fsm.setupStates = function() {
  var transition = function(_, done) {
    var self = this;
    self._haltHandlersOnError = false;

    self.emit(self._asm.currentState, function(err) {
      if (err) {
        if (isTerminalState(self)) {
          if (domain && self.domain instanceof domain.Domain) {
            err.domainEmitter = self;
            err.domain = self.domain;
            err.domainThrown = false;
            self.domain.emit('error', err);
          } else {
            throw err;
          }
        } else {
          self.response.error = err;
          done(err);
        }
      } else {
        done(self.response.error);
      }
    });

  };

  this.addState('validate', 'build', 'error', transition);
  this.addState('build', 'afterBuild', 'restart', transition);
  this.addState('afterBuild', 'sign', 'restart', transition);
  this.addState('sign', 'send', 'retry', transition);
  this.addState('retry', 'afterRetry', 'afterRetry', transition);
  this.addState('afterRetry', 'sign', 'error', transition);
  this.addState('send', 'validateResponse', 'retry', transition);
  this.addState('validateResponse', 'extractData', 'extractError', transition);
  this.addState('extractError', 'extractData', 'retry', transition);
  this.addState('extractData', 'success', 'retry', transition);
  this.addState('restart', 'build', 'error', transition);
  this.addState('success', 'complete', 'complete', transition);
  this.addState('error', 'complete', 'complete', transition);
  this.addState('complete', null, null, transition);
};
fsm.setupStates();


AWS.Request = inherit({


  constructor: function Request(service, operation, params) {
    var endpoint = service.endpoint;
    var region = service.config.region;

    if (service.isGlobalEndpoint) region = 'us-east-1';

    this.domain = domain && domain.active;
    this.service = service;
    this.operation = operation;
    this.params = params || {};
    this.httpRequest = new AWS.HttpRequest(endpoint, region);
    this.startTime = AWS.util.date.getDate();

    this.response = new AWS.Response(this);
    this._asm = new AcceptorStateMachine(fsm.states, 'validate');
    this._haltHandlersOnError = false;

    AWS.SequentialExecutor.call(this);
    this.emit = this.emitEvent;
  },




  send: function send(callback) {
    if (callback) {
      this.on('complete', function (resp) {
        callback.call(resp, resp.error, resp.data);
      });
    }
    this.runTo();

    return this.response;
  },


  build: function build(callback) {
    return this.runTo('send', callback);
  },


  runTo: function runTo(state, done) {
    this._asm.runTo(state, done, this);
    return this;
  },


  abort: function abort() {
    this.removeAllListeners('validateResponse');
    this.removeAllListeners('extractError');
    this.on('validateResponse', function addAbortedError(resp) {
      resp.error = AWS.util.error(new Error('Request aborted by user'), {
         code: 'RequestAbortedError', retryable: false
      });
    });

    if (this.httpRequest.stream) { // abort HTTP stream
      this.httpRequest.stream.abort();
      if (this.httpRequest._abortCallback) {
         this.httpRequest._abortCallback();
      } else {
        this.removeAllListeners('send'); // haven't sent yet, so let's not
      }
    }

    return this;
  },


  eachPage: function eachPage(callback) {
    callback = AWS.util.fn.makeAsync(callback, 3);

    function wrappedCallback(response) {
      callback.call(response, response.error, response.data, function (result) {
        if (result === false) return;

        if (response.hasNextPage()) {
          response.nextPage().on('complete', wrappedCallback).send();
        } else {
          callback.call(response, null, null, AWS.util.fn.noop);
        }
      });
    }

    this.on('complete', wrappedCallback).send();
  },


  eachItem: function eachItem(callback) {
    var self = this;
    function wrappedCallback(err, data) {
      if (err) return callback(err, null);
      if (data === null) return callback(null, null);

      var config = self.service.paginationConfig(self.operation);
      var resultKey = config.resultKey;
      if (Array.isArray(resultKey)) resultKey = resultKey[0];
      var results = AWS.util.jamespath.query(resultKey, data);
      AWS.util.arrayEach(results, function(result) {
        AWS.util.arrayEach(result, function(item) { callback(null, item); });
      });
    }

    this.eachPage(wrappedCallback);
  },


  isPageable: function isPageable() {
    return this.service.paginationConfig(this.operation) ? true : false;
  },


  createReadStream: function createReadStream() {
    var streams = AWS.util.nodeRequire('stream');
    var req = this;
    var stream = null;

    if (AWS.HttpClient.streamsApiVersion === 2) {
      stream = new streams.PassThrough();
      req.send();
    } else {
      stream = new streams.Stream();
      stream.readable = true;

      stream.sent = false;
      stream.on('newListener', function(event) {
        if (!stream.sent && event === 'data') {
          stream.sent = true;
          process.nextTick(function() { req.send(); });
        }
      });
    }

    this.on('httpHeaders', function streamHeaders(statusCode, headers, resp) {
      if (statusCode < 300) {
        req.removeListener('httpData', AWS.EventListeners.Core.HTTP_DATA);
        req.removeListener('httpError', AWS.EventListeners.Core.HTTP_ERROR);
        req.on('httpError', function streamHttpError(error) {
          resp.error = error;
          resp.error.retryable = false;
        });

        var httpStream = resp.httpResponse.createUnbufferedStream();
        if (AWS.HttpClient.streamsApiVersion === 2) {
          httpStream.pipe(stream);
        } else {
          httpStream.on('data', function(arg) {
            stream.emit('data', arg);
          });
          httpStream.on('end', function() {
            stream.emit('end');
          });
        }

        httpStream.on('error', function(err) {
          stream.emit('error', err);
        });
      }
    });

    this.on('error', function(err) {
      stream.emit('error', err);
    });

    return stream;
  },


  emitEvent: function emit(eventName, args, done) {
    if (typeof args === 'function') { done = args; args = null; }
    if (!done) done = function() { };
    if (!args) args = this.eventParameters(eventName, this.response);

    var origEmit = AWS.SequentialExecutor.prototype.emit;
    origEmit.call(this, eventName, args, function (err) {
      if (err) this.response.error = err;
      done.call(this, err);
    });
  },


  eventParameters: function eventParameters(eventName) {
    switch (eventName) {
      case 'restart':
      case 'validate':
      case 'sign':
      case 'build':
      case 'afterValidate':
      case 'afterBuild':
        return [this];
      case 'error':
        return [this.response.error, this.response];
      default:
        return [this.response];
    }
  },


  presign: function presign(expires, callback) {
    if (!callback && typeof expires === 'function') {
      callback = expires;
      expires = null;
    }
    return new AWS.Signers.Presign().sign(this.toGet(), expires, callback);
  },


  toUnauthenticated: function toUnauthenticated() {
    this.removeListener('validate', AWS.EventListeners.Core.VALIDATE_CREDENTIALS);
    this.removeListener('sign', AWS.EventListeners.Core.SIGN);
    return this.toGet();
  },


  toGet: function toGet() {
    if (this.service.api.protocol === 'query' ||
        this.service.api.protocol === 'ec2') {
      this.removeListener('build', this.buildAsGet);
      this.addListener('build', this.buildAsGet);
    }
    return this;
  },


  buildAsGet: function buildAsGet(request) {
    request.httpRequest.method = 'GET';
    request.httpRequest.path = request.service.endpoint.path +
                               '?' + request.httpRequest.body;
    request.httpRequest.body = '';

    delete request.httpRequest.headers['Content-Length'];
    delete request.httpRequest.headers['Content-Type'];
  },


  haltHandlersOnError: function haltHandlersOnError() {
    this._haltHandlersOnError = true;
  }
});

AWS.util.mixin(AWS.Request, AWS.SequentialExecutor);

}).call(this,require("FWaASH"))
},{"./core":3,"./state_machine":50,"FWaASH":65}],31:[function(require,module,exports){


var AWS = require('./core');
var inherit = AWS.util.inherit;


AWS.ResourceWaiter = inherit({

  constructor: function constructor(service, state) {
    this.service = service;
    this.state = state;

    if (typeof this.state === 'object') {
      AWS.util.each.call(this, this.state, function (key, value) {
        this.state = key;
        this.expectedValue = value;
      });
    }

    this.loadWaiterConfig(this.state);
    if (!this.expectedValue) {
      this.expectedValue = this.config.successValue;
    }
  },

  service: null,

  state: null,

  expectedValue: null,

  config: null,

  waitDone: false,

  Listeners: {
    retry: new AWS.SequentialExecutor().addNamedListeners(function(add) {
      add('RETRY_CHECK', 'retry', function(resp) {
        var waiter = resp.request._waiter;
        if (resp.error && resp.error.code === 'ResourceNotReady') {
          resp.error.retryDelay = waiter.config.interval * 1000;
        }
      });
    }),

    output: new AWS.SequentialExecutor().addNamedListeners(function(add) {
      add('CHECK_OUT_ERROR', 'extractError', function CHECK_OUT_ERROR(resp) {
        if (resp.error) {
          resp.request._waiter.setError(resp, true);
        }
      });

      add('CHECK_OUTPUT', 'extractData', function CHECK_OUTPUT(resp) {
        var waiter = resp.request._waiter;
        var success = waiter.checkSuccess(resp);
        if (!success) {
          waiter.setError(resp, success === null ? false : true);
        } else {
          resp.error = null;
        }
      });
    }),

    error: new AWS.SequentialExecutor().addNamedListeners(function(add) {
      add('CHECK_ERROR', 'extractError', function CHECK_ERROR(resp) {
        var waiter = resp.request._waiter;
        var success = waiter.checkError(resp);
        if (!success) {
          waiter.setError(resp, success === null ? false : true);
        } else {
          resp.error = null;
          resp.data = {};
          resp.request.removeAllListeners('extractData');
        }
      });

      add('CHECK_ERR_OUTPUT', 'extractData', function CHECK_ERR_OUTPUT(resp) {
        resp.request._waiter.setError(resp, true);
      });
    })
  },


  wait: function wait(params, callback) {
    if (typeof params === 'function') {
      callback = params; params = undefined;
    }

    var request = this.service.makeRequest(this.config.operation, params);
    var listeners = this.Listeners[this.config.successType];
    request._waiter = this;
    request.response.maxRetries = this.config.maxAttempts;
    request.addListeners(this.Listeners.retry);
    if (listeners) request.addListeners(listeners);

    if (callback) request.send(callback);
    return request;
  },

  setError: function setError(resp, retryable) {
    resp.data = null;
    resp.error = AWS.util.error(resp.error || new Error(), {
      code: 'ResourceNotReady',
      message: 'Resource is not in the state ' + this.state,
      retryable: retryable
    });
  },


  checkSuccess: function checkSuccess(resp) {
    if (!this.config.successPath) {
      return resp.httpResponse.statusCode < 300;
    }

    var r = AWS.util.jamespath.find(this.config.successPath, resp.data);

    if (this.config.failureValue &&
        this.config.failureValue.indexOf(r) >= 0) {
      return null; // fast fail
    }

    if (this.expectedValue) {
      return r === this.expectedValue;
    } else {
      return r ? true : false;
    }
  },


  checkError: function checkError(resp) {
    var value = this.config.successValue;
    if (typeof value === 'number') {
      return resp.httpResponse.statusCode === value;
    } else {
      return resp.error && resp.error.code === value;
    }
  },


  loadWaiterConfig: function loadWaiterConfig(state, noException) {
    if (!this.service.api.waiters[state]) {
      if (noException) return;
      throw new AWS.util.error(new Error(), {
        code: 'StateNotFoundError',
        message: 'State ' + state + ' not found.'
      });
    }

    this.config = this.service.api.waiters[state];
    var config = this.config;

    (function () { // anonymous function to avoid max complexity count
      config.successType = config.successType || config.acceptorType;
      config.successPath = config.successPath || config.acceptorPath;
      config.successValue = config.successValue || config.acceptorValue;
      config.failureType = config.failureType || config.acceptorType;
      config.failurePath = config.failurePath || config.acceptorPath;
      config.failureValue = config.failureValue || config.acceptorValue;
    })();
  }
});

},{"./core":3}],32:[function(require,module,exports){
var AWS = require('./core');
var inherit = AWS.util.inherit;


AWS.Response = inherit({


  constructor: function Response(request) {
    this.request = request;
    this.data = null;
    this.error = null;
    this.retryCount = 0;
    this.redirectCount = 0;
    this.httpResponse = new AWS.HttpResponse();
    if (request) {
      this.maxRetries = request.service.numRetries();
      this.maxRedirects = request.service.config.maxRedirects;
    }
  },


  nextPage: function nextPage(callback) {
    var config;
    var service = this.request.service;
    var operation = this.request.operation;
    try {
      config = service.paginationConfig(operation, true);
    } catch (e) { this.error = e; }

    if (!this.hasNextPage()) {
      if (callback) callback(this.error, null);
      else if (this.error) throw this.error;
      return null;
    }

    var params = AWS.util.copy(this.request.params);
    if (!this.nextPageTokens) {
      return callback ? callback(null, null) : null;
    } else {
      var inputTokens = config.inputToken;
      if (typeof inputTokens === 'string') inputTokens = [inputTokens];
      for (var i = 0; i < inputTokens.length; i++) {
        params[inputTokens[i]] = this.nextPageTokens[i];
      }
      return service.makeRequest(this.request.operation, params, callback);
    }
  },


  hasNextPage: function hasNextPage() {
    this.cacheNextPageTokens();
    if (this.nextPageTokens) return true;
    if (this.nextPageTokens === undefined) return undefined;
    else return false;
  },


  cacheNextPageTokens: function cacheNextPageTokens() {
    if (this.hasOwnProperty('nextPageTokens')) return this.nextPageTokens;
    this.nextPageTokens = undefined;

    var config = this.request.service.paginationConfig(this.request.operation);
    if (!config) return this.nextPageTokens;

    this.nextPageTokens = null;
    if (config.moreResults) {
      if (!AWS.util.jamespath.find(config.moreResults, this.data)) {
        return this.nextPageTokens;
      }
    }

    var exprs = config.outputToken;
    if (typeof exprs === 'string') exprs = [exprs];
    AWS.util.arrayEach.call(this, exprs, function (expr) {
      var output = AWS.util.jamespath.find(expr, this.data);
      if (output) {
        this.nextPageTokens = this.nextPageTokens || [];
        this.nextPageTokens.push(output);
      }
    });

    return this.nextPageTokens;
  }

});

},{"./core":3}],33:[function(require,module,exports){
(function (Buffer){
var AWS = require('../core');
var byteLength = AWS.util.string.byteLength;


AWS.S3.ManagedUpload = AWS.util.inherit({

  constructor: function ManagedUpload(options) {
    var self = this;
    AWS.SequentialExecutor.call(self);
    self.body = null;
    self.sliceFn = null;
    self.callback = null;
    self.parts = {};
    self.completeInfo = [];
    self.fillQueue = function() {
      self.callback(new Error('Unsupported body payload ' + typeof self.body));
    };

    self.configure(options);
  },


  configure: function configure(options) {
    options = options || {};
    this.partSize = this.minPartSize;

    if (options.queueSize) this.queueSize = options.queueSize;
    if (options.partSize) this.partSize = options.partSize;
    if (options.leavePartsOnError) this.leavePartsOnError = true;

    if (this.partSize < this.minPartSize) {
      throw new Error('partSize must be greater than ' +
                      this.minPartSize);
    }

    this.service = options.service;
    this.bindServiceObject(options.params);
    this.validateBody();
    this.adjustTotalBytes();
  },


  leavePartsOnError: false,


  queueSize: 4,


  partSize: null,


  minPartSize: 1024 * 1024 * 5,


  maxTotalParts: 10000,


  send: function(callback) {
    var self = this;
    self.callback = callback || function(err) { if (err) throw err; };

    var runFill = true;
    if (self.sliceFn) {
      self.fillQueue = self.fillBuffer;
    } else if (AWS.util.isNode()) {
      var Stream = AWS.util.nodeRequire('stream').Stream;
      if (self.body instanceof Stream) {
        runFill = false;
        self.fillQueue = self.fillStream;
        self.partBuffers = [];
        self.body.
          on('readable', function() { self.fillQueue(); }).
          on('end', function() {
            self.isDoneChunking = true;
            self.numParts = self.totalPartNumbers;
            self.fillQueue.call(self);
          });
      }
    }

    if (runFill) self.fillQueue.call(self);
  },


  abort: function() {
    this.cleanup(AWS.util.error(new Error('Request aborted by user'), {
      code: 'RequestAbortedError', retryable: false
    }));
  },


  validateBody: function validateBody() {
    var self = this;
    self.body = self.service.config.params.Body;
    if (!self.body) throw new Error('params.Body is required');
    if (typeof self.body === 'string') {
      self.body = new AWS.util.Buffer(self.body);
    }
    self.sliceFn = AWS.util.arraySliceFn(self.body);
  },


  bindServiceObject: function bindServiceObject(params) {
    params = params || {};
    var self = this;

    if (!self.service) {
      self.service = new AWS.S3({params: params});
    } else {
      var config = AWS.util.copy(self.service.config);
      self.service = new self.service.constructor.__super__(config);
      self.service.config.params =
        AWS.util.merge(self.service.config.params || {}, params);
    }
  },


  adjustTotalBytes: function adjustTotalBytes() {
    var self = this;
    try { // try to get totalBytes
      self.totalBytes = byteLength(self.body);
    } catch (e) { }

    if (self.totalBytes) {
      var newPartSize = Math.ceil(self.totalBytes / self.maxTotalParts);
      if (newPartSize > self.partSize) self.partSize = newPartSize;
    } else {
      self.totalBytes = undefined;
    }
  },


  isDoneChunking: false,


  partPos: 0,


  totalChunkedBytes: 0,


  totalUploadedBytes: 0,


  totalBytes: undefined,


  numParts: 0,


  totalPartNumbers: 0,


  activeParts: 0,


  doneParts: 0,


  parts: null,


  completeInfo: null,


  failed: false,


  multipartReq: null,


  partBuffers: null,


  partBufferLength: 0,


  fillBuffer: function fillBuffer() {
    var self = this;
    var bodyLen = byteLength(self.body);

    if (bodyLen === 0) {
      self.isDoneChunking = true;
      self.numParts = 1;
      self.nextChunk(self.body);
      return;
    }

    while (self.activeParts < self.queueSize && self.partPos < bodyLen) {
      var endPos = Math.min(self.partPos + self.partSize, bodyLen);
      var buf = self.sliceFn.call(self.body, self.partPos, endPos);
      self.partPos += self.partSize;

      if (byteLength(buf) < self.partSize || self.partPos === bodyLen) {
        self.isDoneChunking = true;
        self.numParts = self.totalPartNumbers + 1;
      }
      self.nextChunk(buf);
    }
  },


  fillStream: function fillStream() {
    var self = this;
    if (self.activeParts >= self.queueSize) return;

    var buf = self.body.read(self.partSize - self.partBufferLength) ||
              self.body.read();
    if (buf) {
      self.partBuffers.push(buf);
      self.partBufferLength += buf.length;
      self.totalChunkedBytes += buf.length;
    }

    if (self.partBufferLength >= self.partSize) {
      var pbuf = Buffer.concat(self.partBuffers);
      self.partBuffers = [];
      self.partBufferLength = 0;

      if (pbuf.length > self.partSize) {
        var rest = pbuf.slice(self.partSize);
        self.partBuffers.push(rest);
        self.partBufferLength += rest.length;
        pbuf = pbuf.slice(0, self.partSize);
      }

      self.nextChunk(pbuf);
    }

    if (self.isDoneChunking && !self.isDoneSending) {
      pbuf = Buffer.concat(self.partBuffers);
      self.partBuffers = [];
      self.partBufferLength = 0;
      self.totalBytes = self.totalChunkedBytes;
      self.isDoneSending = true;

      if (self.numParts === 0 || pbuf.length > 0) {
        self.numParts++;
        self.nextChunk(pbuf);
      }
    }

    self.body.read(0);
  },


  nextChunk: function nextChunk(chunk) {
    var self = this;
    if (self.failed) return null;

    var partNumber = ++self.totalPartNumbers;
    if (self.isDoneChunking && partNumber === 1) {
      var req = self.service.putObject({Body: chunk});
      req._managedUpload = self;
      req.on('httpUploadProgress', self.progress).send(self.finishSinglePart);
      return null;
    }

    self.activeParts++;
    if (!self.service.config.params.UploadId) {

      if (!self.multipartReq) { // create multipart
        self.multipartReq = self.service.createMultipartUpload();
        self.multipartReq.on('success', function(resp) {
          self.service.config.params.UploadId = resp.data.UploadId;
          self.multipartReq = null;
        });
        self.queueChunks(chunk, partNumber);
        self.multipartReq.on('error', function(err) {
          self.cleanup(err);
        });
        self.multipartReq.send();
      } else {
        self.queueChunks(chunk, partNumber);
      }
    } else { // multipart is created, just send
      self.uploadPart(chunk, partNumber);
    }
  },


  uploadPart: function uploadPart(chunk, partNumber) {
    var self = this;
    var partParams = {
      Body: chunk,
      ContentLength: AWS.util.string.byteLength(chunk),
      PartNumber: partNumber
    };

    var partInfo = {ETag: null, PartNumber: partNumber};
    self.completeInfo.push(partInfo);

    var req = self.service.uploadPart(partParams);
    self.parts[partNumber] = req;
    req._lastUploadedBytes = 0;
    req._managedUpload = self;
    req.on('httpUploadProgress', self.progress);
    req.send(function(err, data) {
      delete self.parts[partParams.PartNumber];
      self.activeParts--;

      if (!err && (!data || !data.ETag)) {
        var message = 'No access to ETag property on response.';
        if (AWS.util.isBrowser()) {
          message += ' Check CORS configuration to expose ETag header.';
        }

        err = AWS.util.error(new Error(message), {
          code: 'ETagMissing', retryable: false
        });
      }
      if (err) return self.cleanup(err);

      partInfo.ETag = data.ETag;
      self.doneParts++;
      if (self.isDoneChunking && self.doneParts === self.numParts) {
        self.finishMultiPart();
      } else {
        self.fillQueue.call(self);
      }
    });
  },


  queueChunks: function queueChunks(chunk, partNumber) {
    var self = this;
    self.multipartReq.on('success', function() {
      self.uploadPart(chunk, partNumber);
    });
  },


  cleanup: function cleanup(err) {
    var self = this;
    if (self.failed) return;

    if (typeof self.body.removeAllListeners === 'function' &&
        typeof self.body.resume === 'function') {
      self.body.removeAllListeners('readable');
      self.body.removeAllListeners('end');
      self.body.resume();
    }

    if (self.service.config.params.UploadId && !self.leavePartsOnError) {
      self.service.abortMultipartUpload().send();
    }

    AWS.util.each(self.parts, function(partNumber, part) {
      part.removeAllListeners('complete');
      part.abort();
    });

    self.parts = {};
    self.callback(err);
    self.failed = true;
  },


  finishMultiPart: function finishMultiPart() {
    var self = this;
    var completeParams = { MultipartUpload: { Parts: self.completeInfo } };
    self.service.completeMultipartUpload(completeParams, function(err, data) {
      if (err) return self.cleanup(err);
      else self.callback(err, data);
    });
  },


  finishSinglePart: function finishSinglePart(err, data) {
    var upload = this.request._managedUpload;
    var httpReq = this.request.httpRequest;
    var url = AWS.util.urlFormat(httpReq.endpoint);
    if (err) return upload.callback(err);
    data.Location = url.substr(0, url.length - 1) + httpReq.path;
    upload.callback(err, data);
  },


  progress: function progress(info) {
    var upload = this._managedUpload;
    if (this.operation === 'putObject') {
      info.part = 1;
    } else {
      upload.totalUploadedBytes += info.loaded - this._lastUploadedBytes;
      this._lastUploadedBytes = info.loaded;
      info = {
        loaded: upload.totalUploadedBytes,
        total: upload.totalBytes,
        part: this.params.PartNumber
      };
    }
    upload.emit('httpUploadProgress', [info]);
  }
});

AWS.util.mixin(AWS.S3.ManagedUpload, AWS.SequentialExecutor);
module.exports = AWS.S3.ManagedUpload;

}).call(this,require("buffer").Buffer)
},{"../core":3,"buffer":54}],34:[function(require,module,exports){
var AWS = require('./core');


AWS.SequentialExecutor = AWS.util.inherit({

  constructor: function SequentialExecutor() {
    this._events = {};
  },


  listeners: function listeners(eventName) {
    return this._events[eventName] ? this._events[eventName].slice(0) : [];
  },

  on: function on(eventName, listener) {
    if (this._events[eventName]) {
      this._events[eventName].push(listener);
    } else {
      this._events[eventName] = [listener];
    }
    return this;
  },


  onAsync: function onAsync(eventName, listener) {
    listener._isAsync = true;
    return this.on(eventName, listener);
  },

  removeListener: function removeListener(eventName, listener) {
    var listeners = this._events[eventName];
    if (listeners) {
      var length = listeners.length;
      var position = -1;
      for (var i = 0; i < length; ++i) {
        if (listeners[i] === listener) {
          position = i;
        }
      }
      if (position > -1) {
        listeners.splice(position, 1);
      }
    }
    return this;
  },

  removeAllListeners: function removeAllListeners(eventName) {
    if (eventName) {
      delete this._events[eventName];
    } else {
      this._events = {};
    }
    return this;
  },


  emit: function emit(eventName, eventArgs, doneCallback) {
    if (!doneCallback) doneCallback = function() { };
    var listeners = this.listeners(eventName);
    var count = listeners.length;
    this.callListeners(listeners, eventArgs, doneCallback);
    return count > 0;
  },


  callListeners: function callListeners(listeners, args, doneCallback, prevError) {
    var self = this;
    var error = prevError || null;

    function callNextListener(err) {
      if (err) {
        error = AWS.util.error(error || new Error(), err);
        if (self._haltHandlersOnError) {
          return doneCallback.call(self, error);
        }
      }
      self.callListeners(listeners, args, doneCallback, error);
    }

    while (listeners.length > 0) {
      var listener = listeners.shift();
      if (listener._isAsync) { // asynchronous listener
        listener.apply(self, args.concat([callNextListener]));
        return; // stop here, callNextListener will continue
      } else { // synchronous listener
        try {
          listener.apply(self, args);
        } catch (err) {
          error = AWS.util.error(error || new Error(), err);
        }
        if (error && self._haltHandlersOnError) {
          doneCallback.call(self, error);
          return;
        }
      }
    }
    doneCallback.call(self, error);
  },


  addListeners: function addListeners(listeners) {
    var self = this;

    if (listeners._events) listeners = listeners._events;

    AWS.util.each(listeners, function(event, callbacks) {
      if (typeof callbacks === 'function') callbacks = [callbacks];
      AWS.util.arrayEach(callbacks, function(callback) {
        self.on(event, callback);
      });
    });

    return self;
  },


  addNamedListener: function addNamedListener(name, eventName, callback) {
    this[name] = callback;
    this.addListener(eventName, callback);
    return this;
  },


  addNamedAsyncListener: function addNamedAsyncListener(name, eventName, callback) {
    callback._isAsync = true;
    return this.addNamedListener(name, eventName, callback);
  },


  addNamedListeners: function addNamedListeners(callback) {
    var self = this;
    callback(
      function() {
        self.addNamedListener.apply(self, arguments);
      },
      function() {
        self.addNamedAsyncListener.apply(self, arguments);
      }
    );
    return this;
  }
});


AWS.SequentialExecutor.prototype.addListener = AWS.SequentialExecutor.prototype.on;

module.exports = AWS.SequentialExecutor;

},{"./core":3}],35:[function(require,module,exports){
var AWS = require('./core');
var Api = require('./model/api');
var regionConfig = require('./region_config');
var inherit = AWS.util.inherit;


AWS.Service = inherit({

  constructor: function Service(config) {
    if (!this.loadServiceClass) {
      throw AWS.util.error(new Error(),
        'Service must be constructed with `new\' operator');
    }
    var ServiceClass = this.loadServiceClass(config || {});
    if (ServiceClass) return new ServiceClass(config);
    this.initialize(config);
  },


  initialize: function initialize(config) {
    var svcConfig = AWS.config[this.serviceIdentifier];

    this.config = new AWS.Config(AWS.config);
    if (svcConfig) this.config.update(svcConfig, true);
    if (config) this.config.update(config, true);

    this.validateService();
    if (!this.config.endpoint) regionConfig(this);

    this.config.endpoint = this.endpointFromTemplate(this.config.endpoint);
    this.setEndpoint(this.config.endpoint);
  },


  validateService: function validateService() {
  },


  loadServiceClass: function loadServiceClass(serviceConfig) {
    var config = serviceConfig;
    if (!AWS.util.isEmpty(this.api)) {
      return null;
    } else if (config.apiConfig) {
      return AWS.Service.defineServiceApi(this.constructor, config.apiConfig);
    } else if (!this.constructor.services) {
      return null;
    } else {
      config = new AWS.Config(AWS.config);
      config.update(serviceConfig, true);
      var version = config.apiVersions[this.constructor.serviceIdentifier];
      version = version || config.apiVersion;
      return this.getLatestServiceClass(version);
    }
  },


  getLatestServiceClass: function getLatestServiceClass(version) {
    version = this.getLatestServiceVersion(version);
    if (this.constructor.services[version] === null) {
      AWS.Service.defineServiceApi(this.constructor, version);
    }

    return this.constructor.services[version];
  },


  getLatestServiceVersion: function getLatestServiceVersion(version) {
    if (!this.constructor.services || this.constructor.services.length === 0) {
      throw new Error('No services defined on ' +
                      this.constructor.serviceIdentifier);
    }

    if (!version) {
      version = 'latest';
    } else if (AWS.util.isType(version, Date)) {
      version = AWS.util.date.iso8601(version).split('T')[0];
    }

    if (Object.hasOwnProperty(this.constructor.services, version)) {
      return version;
    }

    var keys = Object.keys(this.constructor.services).sort();
    var selectedVersion = null;
    for (var i = keys.length - 1; i >= 0; i--) {
      if (keys[i][keys[i].length - 1] !== '*') {
        selectedVersion = keys[i];
      }
      if (keys[i].substr(0, 10) <= version) {
        return selectedVersion;
      }
    }

    throw new Error('Could not find ' + this.constructor.serviceIdentifier +
                    ' API to satisfy version constraint `' + version + '\'');
  },


  api: {},


  defaultRetryCount: 3,


  makeRequest: function makeRequest(operation, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = null;
    }

    params = params || {};
    if (this.config.params) { // copy only toplevel bound params
      var rules = this.api.operations[operation];
      if (rules) {
        params = AWS.util.copy(params);
        AWS.util.each(this.config.params, function(key, value) {
          if (rules.input.members[key]) {
            if (params[key] === undefined || params[key] === null) {
              params[key] = value;
            }
          }
        });
      }
    }

    var request = new AWS.Request(this, operation, params);
    this.addAllRequestListeners(request);

    if (callback) request.send(callback);
    return request;
  },


  makeUnauthenticatedRequest: function makeUnauthenticatedRequest(operation, params, callback) {
    if (typeof params === 'function') {
      callback = params;
      params = {};
    }

    var request = this.makeRequest(operation, params).toUnauthenticated();
    return callback ? request.send(callback) : request;
  },


  waitFor: function waitFor(state, params, callback) {
    var waiter = new AWS.ResourceWaiter(this, state);
    return waiter.wait(params, callback);
  },


  addAllRequestListeners: function addAllRequestListeners(request) {
    var list = [AWS.events, AWS.EventListeners.Core, this.serviceInterface(),
                AWS.EventListeners.CorePost];
    for (var i = 0; i < list.length; i++) {
      if (list[i]) request.addListeners(list[i]);
    }

    if (!this.config.paramValidation) {
      request.removeListener('validate',
        AWS.EventListeners.Core.VALIDATE_PARAMETERS);
    }

    if (this.config.logger) { // add logging events
      request.addListeners(AWS.EventListeners.Logger);
    }

    this.setupRequestListeners(request);
  },


  setupRequestListeners: function setupRequestListeners() {
  },


  getSignerClass: function getSignerClass() {
    var version;
    if (this.config.signatureVersion) {
      version = this.config.signatureVersion;
    } else {
      version = this.api.signatureVersion;
    }
    return AWS.Signers.RequestSigner.getVersion(version);
  },


  serviceInterface: function serviceInterface() {
    switch (this.api.protocol) {
      case 'ec2': return AWS.EventListeners.Query;
      case 'query': return AWS.EventListeners.Query;
      case 'json': return AWS.EventListeners.Json;
      case 'rest-json': return AWS.EventListeners.RestJson;
      case 'rest-xml': return AWS.EventListeners.RestXml;
    }
    if (this.api.protocol) {
      throw new Error('Invalid service `protocol\' ' +
        this.api.protocol + ' in API config');
    }
  },


  successfulResponse: function successfulResponse(resp) {
    return resp.httpResponse.statusCode < 300;
  },


  numRetries: function numRetries() {
    if (this.config.maxRetries !== undefined) {
      return this.config.maxRetries;
    } else {
      return this.defaultRetryCount;
    }
  },


  retryDelays: function retryDelays() {
    var retryCount = this.numRetries();
    var delays = [];
    for (var i = 0; i < retryCount; ++i) {
      delays[i] = Math.pow(2, i) * 30;
    }
    return delays;
  },


  retryableError: function retryableError(error) {
    if (this.networkingError(error)) return true;
    if (this.expiredCredentialsError(error)) return true;
    if (this.throttledError(error)) return true;
    if (error.statusCode >= 500) return true;
    return false;
  },


  networkingError: function networkingError(error) {
    return error.code === 'NetworkingError';
  },


  expiredCredentialsError: function expiredCredentialsError(error) {
    return (error.code === 'ExpiredTokenException');
  },


  throttledError: function throttledError(error) {
    switch (error.code) {
      case 'ProvisionedThroughputExceededException':
      case 'Throttling':
      case 'ThrottlingException':
      case 'RequestLimitExceeded':
      case 'RequestThrottled':
        return true;
      default:
        return false;
    }
  },


  endpointFromTemplate: function endpointFromTemplate(endpoint) {
    if (typeof endpoint !== 'string') return endpoint;

    var e = endpoint;
    e = e.replace(/\{service\}/g, this.api.endpointPrefix);
    e = e.replace(/\{region\}/g, this.config.region);
    e = e.replace(/\{scheme\}/g, this.config.sslEnabled ? 'https' : 'http');
    return e;
  },


  setEndpoint: function setEndpoint(endpoint) {
    this.endpoint = new AWS.Endpoint(endpoint, this.config);
  },


  paginationConfig: function paginationConfig(operation, throwException) {
    var paginator = this.api.operations[operation].paginator;
    if (!paginator) {
      if (throwException) {
        var e = new Error();
        throw AWS.util.error(e, 'No pagination configuration for ' + operation);
      }
      return null;
    }

    return paginator;
  }
});

AWS.util.update(AWS.Service, {


  defineMethods: function defineMethods(svc) {
    AWS.util.each(svc.prototype.api.operations, function iterator(method) {
      if (svc.prototype[method]) return;
      svc.prototype[method] = function (params, callback) {
        return this.makeRequest(method, params, callback);
      };
    });
  },


  defineService: function defineService(serviceIdentifier, versions, features) {
    AWS.Service._serviceMap[serviceIdentifier] = true;
    if (!Array.isArray(versions)) {
      features = versions;
      versions = [];
    }

    var svc = inherit(AWS.Service, features || {});

    if (typeof serviceIdentifier === 'string') {
      AWS.Service.addVersions(svc, versions);

      var identifier = svc.serviceIdentifier || serviceIdentifier;
      svc.serviceIdentifier = identifier;
    } else { // defineService called with an API
      svc.prototype.api = serviceIdentifier;
      AWS.Service.defineMethods(svc);
    }

    return svc;
  },


  addVersions: function addVersions(svc, versions) {
    if (!Array.isArray(versions)) versions = [versions];

    svc.services = svc.services || {};
    for (var i = 0; i < versions.length; i++) {
      if (svc.services[versions[i]] === undefined) {
        svc.services[versions[i]] = null;
      }
    }

    svc.apiVersions = Object.keys(svc.services).sort();
  },


  defineServiceApi: function defineServiceApi(superclass, version, apiConfig) {
    var svc = inherit(superclass, {
      serviceIdentifier: superclass.serviceIdentifier
    });

    function setApi(api) {
      if (api.isApi) {
        svc.prototype.api = api;
      } else {
        svc.prototype.api = new Api(api);
      }
    }

    if (typeof version === 'string') {
      if (apiConfig) {
        setApi(apiConfig);
      } else {
        try {
          setApi(AWS.apiLoader(superclass.serviceIdentifier, version));
        } catch (err) {
          throw AWS.util.error(err, {
            message: 'Could not find API configuration ' +
              superclass.serviceIdentifier + '-' + version
          });
        }
      }
      if (!superclass.services.hasOwnProperty(version)) {
        superclass.apiVersions = superclass.apiVersions.concat(version).sort();
      }
      superclass.services[version] = svc;
    } else {
      setApi(version);
    }

    AWS.Service.defineMethods(svc);
    return svc;
  },


  hasService: function(identifier) {
    return AWS.Service._serviceMap.hasOwnProperty(identifier);
  },


  _serviceMap: {}
});

},{"./core":3,"./model/api":15,"./region_config":28}],36:[function(require,module,exports){
var AWS = require('../core');

AWS.util.update(AWS.CognitoIdentity.prototype, {
  getOpenIdToken: function getOpenIdToken(params, callback) {
    return this.makeUnauthenticatedRequest('getOpenIdToken', params, callback);
  },

  getId: function getId(params, callback) {
    return this.makeUnauthenticatedRequest('getId', params, callback);
  },

  getCredentialsForIdentity: function getCredentialsForIdentity(params, callback) {
    return this.makeUnauthenticatedRequest('getCredentialsForIdentity', params, callback);
  }
});

},{"../core":3}],37:[function(require,module,exports){
var AWS = require('../core');

AWS.util.update(AWS.DynamoDB.prototype, {

  setupRequestListeners: function setupRequestListeners(request) {
    if (request.service.config.dynamoDbCrc32) {
      request.addListener('extractData', this.checkCrc32);
    }
  },


  checkCrc32: function checkCrc32(resp) {
    if (!resp.httpResponse.streaming && !resp.request.service.crc32IsValid(resp)) {
      resp.error = AWS.util.error(new Error(), {
        code: 'CRC32CheckFailed',
        message: 'CRC32 integrity check failed',
        retryable: true
      });
    }
  },


  crc32IsValid: function crc32IsValid(resp) {
    var crc = resp.httpResponse.headers['x-amz-crc32'];
    if (!crc) return true; // no (valid) CRC32 header
    return parseInt(crc, 10) === AWS.util.crypto.crc32(resp.httpResponse.body);
  },


  defaultRetryCount: 10,


  retryDelays: function retryDelays() {
    var retryCount = this.numRetries();
    var delays = [];
    for (var i = 0; i < retryCount; ++i) {
      if (i === 0) {
        delays.push(0);
      } else {
        delays.push(50 * Math.pow(2, i - 1));
      }
    }
    return delays;
  }
});

},{"../core":3}],38:[function(require,module,exports){
var AWS = require('../core');

AWS.util.update(AWS.EC2.prototype, {

  setupRequestListeners: function setupRequestListeners(request) {
    request.removeListener('extractError', AWS.EventListeners.Query.EXTRACT_ERROR);
    request.addListener('extractError', this.extractError);

    if (request.operation === 'copySnapshot') {
      request.onAsync('validate', this.buildCopySnapshotPresignedUrl);
    }
  },


  buildCopySnapshotPresignedUrl: function buildCopySnapshotPresignedUrl(req, done) {
    if (req.params.PresignedUrl || req._subRequest) {
      return done();
    }

    req.params = AWS.util.copy(req.params);
    req.params.DestinationRegion = req.service.config.region;

    var config = AWS.util.copy(req.service.config);
    delete config.endpoint;
    config.region = req.params.SourceRegion;
    var svc = new req.service.constructor(config);
    var newReq = svc[req.operation](req.params);
    newReq._subRequest = true;
    newReq.presign(function(err, url) {
      if (err) done(err);
      else {
        req.params.PresignedUrl = url;
        done();
      }
    });
  },


  extractError: function extractError(resp) {
    var httpResponse = resp.httpResponse;
    var data = new AWS.XML.Parser().parse(httpResponse.body.toString() || '');
    if (data.Errors)
      resp.error = AWS.util.error(new Error(), {
        code: data.Errors.Error.Code,
        message: data.Errors.Error.Message
      });
    else
      resp.error = AWS.util.error(new Error(), {
        code: httpResponse.statusCode,
        message: null
      });
  }
});

},{"../core":3}],39:[function(require,module,exports){
var AWS = require('../core');

AWS.util.update(AWS.MachineLearning.prototype, {

  setupRequestListeners: function setupRequestListeners(request) {
    if (request.operation === 'predict') {
      request.addListener('build', this.buildEndpoint);
    }
  },


  buildEndpoint: function buildEndpoint(request) {
    var url = request.params.PredictEndpoint;
    if (url) {
      request.httpRequest.endpoint = new AWS.Endpoint(url);
    }
  }

});

},{"../core":3}],40:[function(require,module,exports){
var AWS = require('../core');

require('../s3/managed_upload');

AWS.util.update(AWS.S3.prototype, {

  validateService: function validateService() {
    if (!this.config.region) this.config.region = 'us-east-1';

    if (!this.config.endpoint && this.config.s3BucketEndpoint) {
      var msg = 'An endpoint must be provided when configuring ' +
                '`s3BucketEndpoint` to true.';
      throw AWS.util.error(new Error(),
        {name: 'InvalidEndpoint', message: msg});
    }
  },


  setupRequestListeners: function setupRequestListeners(request) {
    request.addListener('validate', this.validateScheme);
    request.addListener('validate', this.validateBucketEndpoint);
    request.addListener('build', this.addContentType);
    request.addListener('build', this.populateURI);
    request.addListener('build', this.computeContentMd5);
    request.addListener('build', this.computeSseCustomerKeyMd5);
    request.addListener('afterBuild', this.addExpect100Continue);
    request.removeListener('validate',
      AWS.EventListeners.Core.VALIDATE_REGION);
    request.addListener('extractError', this.extractError);
    request.addListener('extractData', this.extractData);
    request.addListener('extractData', AWS.util.hoistPayloadMember);
    request.addListener('beforePresign', this.prepareSignedUrl);
  },


  validateScheme: function(req) {
    var params = req.params,
        scheme = req.httpRequest.endpoint.protocol,
        sensitive = params.SSECustomerKey || params.CopySourceSSECustomerKey;
    if (sensitive && scheme !== 'https:') {
      var msg = 'Cannot send SSE keys over HTTP. Set \'sslEnabled\'' +
        'to \'true\' in your configuration';
      throw AWS.util.error(new Error(),
        { code: 'ConfigError', message: msg });
    }
  },


  validateBucketEndpoint: function(req) {
    if (!req.params.Bucket && req.service.config.s3BucketEndpoint) {
      var msg = 'Cannot send requests to root API with `s3BucketEndpoint` set.';
      throw AWS.util.error(new Error(),
        { code: 'ConfigError', message: msg });
    }
  },


  populateURI: function populateURI(req) {
    var httpRequest = req.httpRequest;
    var b = req.params.Bucket;

    if (b) {
      if (!req.service.pathStyleBucketName(b)) {
        if (!req.service.config.s3BucketEndpoint) {
          httpRequest.endpoint.hostname =
            b + '.' + httpRequest.endpoint.hostname;

          var port = httpRequest.endpoint.port;
          if (port !== 80 && port !== 443) {
            httpRequest.endpoint.host = httpRequest.endpoint.hostname + ':' +
              httpRequest.endpoint.port;
          } else {
            httpRequest.endpoint.host = httpRequest.endpoint.hostname;
          }
        }

        httpRequest.virtualHostedBucket = b; // needed for signing the request
        httpRequest.path = httpRequest.path.replace(new RegExp('/' + b), '');
        if (httpRequest.path[0] !== '/') {
          httpRequest.path = '/' + httpRequest.path;
        }
      }
    }
  },


  addExpect100Continue: function addExpect100Continue(req) {
    var len = req.httpRequest.headers['Content-Length'];
    if (AWS.util.isNode() && len >= 1024 * 1024) {
      req.httpRequest.headers['Expect'] = '100-continue';
    }
  },


  addContentType: function addContentType(req) {
    var httpRequest = req.httpRequest;
    if (httpRequest.method === 'GET' || httpRequest.method === 'HEAD') {
      delete httpRequest.headers['Content-Type'];
      return;
    }

    if (!httpRequest.headers['Content-Type']) { // always have a Content-Type
      httpRequest.headers['Content-Type'] = 'application/octet-stream';
    }

    var contentType = httpRequest.headers['Content-Type'];
    if (AWS.util.isBrowser()) {
      if (typeof httpRequest.body === 'string' && !contentType.match(/;\s*charset=/)) {
        var charset = '; charset=UTF-8';
        httpRequest.headers['Content-Type'] += charset;
      } else {
        var replaceFn = function(_, prefix, charsetName) {
          return prefix + charsetName.toUpperCase();
        };

        httpRequest.headers['Content-Type'] =
          contentType.replace(/(;\s*charset=)(.+)$/, replaceFn);
      }
    }
  },


  computableChecksumOperations: {
    putBucketCors: true,
    putBucketLifecycle: true,
    putBucketTagging: true,
    deleteObjects: true
  },


  willComputeChecksums: function willComputeChecksums(req) {
    if (this.computableChecksumOperations[req.operation]) return true;
    if (!this.config.computeChecksums) return false;

    if (!AWS.util.Buffer.isBuffer(req.httpRequest.body) &&
        typeof req.httpRequest.body !== 'string') {
      return false;
    }

    var rules = req.service.api.operations[req.operation].input.members;

    if (req.service.getSignerClass(req) === AWS.Signers.V4) {
      if (rules.ContentMD5 && !rules.ContentMD5.required) return false;
    }

    if (rules.ContentMD5 && !req.params.ContentMD5) return true;
  },


  computeContentMd5: function computeContentMd5(req) {
    if (req.service.willComputeChecksums(req)) {
      var md5 = AWS.util.crypto.md5(req.httpRequest.body, 'base64');
      req.httpRequest.headers['Content-MD5'] = md5;
    }
  },


  computeSseCustomerKeyMd5: function computeSseCustomerKeyMd5(req) {
    var keys = {
      SSECustomerKey: 'x-amz-server-side-encryption-customer-key-MD5',
      CopySourceSSECustomerKey: 'x-amz-copy-source-server-side-encryption-customer-key-MD5'
    };
    AWS.util.each(keys, function(key, header) {
      if (req.params[key]) {
        var value = AWS.util.crypto.md5(req.params[key], 'base64');
        req.httpRequest.headers[header] = value;
      }
    });
  },


  pathStyleBucketName: function pathStyleBucketName(bucketName) {
    if (this.config.s3ForcePathStyle) return true;
    if (this.config.s3BucketEndpoint) return false;

    if (this.dnsCompatibleBucketName(bucketName)) {
      return (this.config.sslEnabled && bucketName.match(/\./)) ? true : false;
    } else {
      return true; // not dns compatible names must always use path style
    }
  },


  dnsCompatibleBucketName: function dnsCompatibleBucketName(bucketName) {
    var b = bucketName;
    var domain = new RegExp(/^[a-z0-9][a-z0-9\.\-]{1,61}[a-z0-9]$/);
    var ipAddress = new RegExp(/(\d+\.){3}\d+/);
    var dots = new RegExp(/\.\./);
    return (b.match(domain) && !b.match(ipAddress) && !b.match(dots)) ? true : false;
  },


  successfulResponse: function successfulResponse(resp) {
    var req = resp.request;
    var httpResponse = resp.httpResponse;
    if (req.operation === 'completeMultipartUpload' &&
        httpResponse.body.toString().match('<Error>'))
      return false;
    else
      return httpResponse.statusCode < 300;
  },


  retryableError: function retryableError(error, request) {
    if (request.operation === 'completeMultipartUpload' &&
        error.statusCode === 200) {
      return true;
    } else if (error && error.code === 'RequestTimeout') {
      return true;
    } else {
      var _super = AWS.Service.prototype.retryableError;
      return _super.call(this, error, request);
    }
  },


  extractData: function extractData(resp) {
    var req = resp.request;
    if (req.operation === 'getBucketLocation') {
      var match = resp.httpResponse.body.toString().match(/>(.+)<\/Location/);
      delete resp.data['_'];
      if (match) {
        resp.data.LocationConstraint = match[1];
      } else {
        resp.data.LocationConstraint = '';
      }
    }
  },


  extractError: function extractError(resp) {
    var codes = {
      304: 'NotModified',
      403: 'Forbidden',
      400: 'BadRequest',
      404: 'NotFound'
    };

    var code = resp.httpResponse.statusCode;
    var body = resp.httpResponse.body || '';
    if (codes[code] && body.length === 0) {
      resp.error = AWS.util.error(new Error(), {
        code: codes[resp.httpResponse.statusCode],
        message: null
      });
    } else {
      var data = new AWS.XML.Parser().parse(body.toString());
      resp.error = AWS.util.error(new Error(), {
        code: data.Code || code,
        message: data.Message || null
      });
    }
  },


  getSignedUrl: function getSignedUrl(operation, params, callback) {
    params = AWS.util.copy(params || {});
    var expires = params.Expires || 900;
    delete params.Expires; // we can't validate this
    var request = this.makeRequest(operation, params);
    return request.presign(expires, callback);
  },


  prepareSignedUrl: function prepareSignedUrl(request) {
    request.addListener('validate', request.service.noPresignedContentLength);
    request.removeListener('build', request.service.addContentType);
    if (!request.params.Body) {
      request.removeListener('build', request.service.computeContentMd5);
    } else {
      request.addListener('afterBuild', AWS.EventListeners.Core.COMPUTE_SHA256);
    }
  },

  noPresignedContentLength: function noPresignedContentLength(request) {
    if (request.params.ContentLength !== undefined) {
      throw AWS.util.error(new Error(), {code: 'UnexpectedParameter',
        message: 'ContentLength is not supported in pre-signed URLs.'});
    }
  },

  createBucket: function createBucket(params, callback) {
    if (!params) params = {};
    var hostname = this.endpoint.hostname;
    if (hostname !== this.api.globalEndpoint && !params.CreateBucketConfiguration) {
      params.CreateBucketConfiguration = { LocationConstraint: this.config.region };
    }
    return this.makeRequest('createBucket', params, callback);
  },


  upload: function upload(params, options, callback) {
    if (typeof options === 'function' && callback === undefined) {
      callback = options;
      options = null;
    }

    options = options || {};
    options = AWS.util.merge(options || {}, {service: this, params: params});

    var uploader = new AWS.S3.ManagedUpload(options);
    if (typeof callback === 'function') uploader.send(callback);
    return uploader;
  }
});

},{"../core":3,"../s3/managed_upload":33}],41:[function(require,module,exports){
var AWS = require('../core');

AWS.util.update(AWS.SQS.prototype, {

  setupRequestListeners: function setupRequestListeners(request) {
    request.addListener('build', this.buildEndpoint);

    if (request.service.config.computeChecksums) {
      if (request.operation === 'sendMessage') {
        request.addListener('extractData', this.verifySendMessageChecksum);
      } else if (request.operation === 'sendMessageBatch') {
        request.addListener('extractData', this.verifySendMessageBatchChecksum);
      } else if (request.operation === 'receiveMessage') {
        request.addListener('extractData', this.verifyReceiveMessageChecksum);
      }
    }
  },


  verifySendMessageChecksum: function verifySendMessageChecksum(response) {
    if (!response.data) return;

    var md5 = response.data.MD5OfMessageBody;
    var body = this.params.MessageBody;
    var calculatedMd5 = this.service.calculateChecksum(body);
    if (calculatedMd5 !== md5) {
      var msg = 'Got "' + response.data.MD5OfMessageBody +
        '", expecting "' + calculatedMd5 + '".';
      this.service.throwInvalidChecksumError(response,
        [response.data.MessageId], msg);
    }
  },


  verifySendMessageBatchChecksum: function verifySendMessageBatchChecksum(response) {
    if (!response.data) return;

    var service = this.service;
    var entries = {};
    var errors = [];
    var messageIds = [];
    AWS.util.arrayEach(response.data.Successful, function (entry) {
      entries[entry.Id] = entry;
    });
    AWS.util.arrayEach(this.params.Entries, function (entry) {
      if (entries[entry.Id]) {
        var md5 = entries[entry.Id].MD5OfMessageBody;
        var body = entry.MessageBody;
        if (!service.isChecksumValid(md5, body)) {
          errors.push(entry.Id);
          messageIds.push(entries[entry.Id].MessageId);
        }
      }
    });

    if (errors.length > 0) {
      service.throwInvalidChecksumError(response, messageIds,
        'Invalid messages: ' + errors.join(', '));
    }
  },


  verifyReceiveMessageChecksum: function verifyReceiveMessageChecksum(response) {
    if (!response.data) return;

    var service = this.service;
    var messageIds = [];
    AWS.util.arrayEach(response.data.Messages, function(message) {
      var md5 = message.MD5OfBody;
      var body = message.Body;
      if (!service.isChecksumValid(md5, body)) {
        messageIds.push(message.MessageId);
      }
    });

    if (messageIds.length > 0) {
      service.throwInvalidChecksumError(response, messageIds,
        'Invalid messages: ' + messageIds.join(', '));
    }
  },


  throwInvalidChecksumError: function throwInvalidChecksumError(response, ids, message) {
    response.error = AWS.util.error(new Error(), {
      retryable: true,
      code: 'InvalidChecksum',
      messageIds: ids,
      message: response.request.operation +
               ' returned an invalid MD5 response. ' + message
    });
  },


  isChecksumValid: function isChecksumValid(checksum, data) {
    return this.calculateChecksum(data) === checksum;
  },


  calculateChecksum: function calculateChecksum(data) {
    return AWS.util.crypto.md5(data, 'hex');
  },


  buildEndpoint: function buildEndpoint(request) {
    var url = request.httpRequest.params.QueueUrl;
    if (url) {
      request.httpRequest.endpoint = new AWS.Endpoint(url);

      var matches = request.httpRequest.endpoint.host.match(/^sqs\.(.+?)\./);
      if (matches) request.httpRequest.region = matches[1];
    }
  }
});

},{"../core":3}],42:[function(require,module,exports){
var AWS = require('../core');

AWS.util.update(AWS.STS.prototype, {

  credentialsFrom: function credentialsFrom(data, credentials) {
    if (!data) return null;
    if (!credentials) credentials = new AWS.TemporaryCredentials();
    credentials.expired = false;
    credentials.accessKeyId = data.Credentials.AccessKeyId;
    credentials.secretAccessKey = data.Credentials.SecretAccessKey;
    credentials.sessionToken = data.Credentials.SessionToken;
    credentials.expireTime = data.Credentials.Expiration;
    return credentials;
  },

  assumeRoleWithWebIdentity: function assumeRoleWithWebIdentity(params, callback) {
    return this.makeUnauthenticatedRequest('assumeRoleWithWebIdentity', params, callback);
  },

  assumeRoleWithSAML: function assumeRoleWithSAML(params, callback) {
    return this.makeUnauthenticatedRequest('assumeRoleWithSAML', params, callback);
  }
});

},{"../core":3}],43:[function(require,module,exports){
var AWS = require('../core');
var inherit = AWS.util.inherit;


var expiresHeader = 'presigned-expires';


function signedUrlBuilder(request) {
  var expires = request.httpRequest.headers[expiresHeader];

  delete request.httpRequest.headers['User-Agent'];
  delete request.httpRequest.headers['X-Amz-User-Agent'];

  if (request.service.getSignerClass() === AWS.Signers.V4) {
    if (expires > 604800) { // one week expiry is invalid
      var message = 'Presigning does not support expiry time greater ' +
                    'than a week with SigV4 signing.';
      throw AWS.util.error(new Error(), {
        code: 'InvalidExpiryTime', message: message, retryable: false
      });
    }
    request.httpRequest.headers[expiresHeader] = expires;
  } else if (request.service.getSignerClass() === AWS.Signers.S3) {
    request.httpRequest.headers[expiresHeader] = parseInt(
      AWS.util.date.unixTimestamp() + expires, 10).toString();
  } else {
    throw AWS.util.error(new Error(), {
      message: 'Presigning only supports S3 or SigV4 signing.',
      code: 'UnsupportedSigner', retryable: false
    });
  }
}


function signedUrlSigner(request) {
  var endpoint = request.httpRequest.endpoint;
  var parsedUrl = AWS.util.urlParse(request.httpRequest.path);
  var queryParams = {};

  if (parsedUrl.search) {
    queryParams = AWS.util.queryStringParse(parsedUrl.search.substr(1));
  }

  AWS.util.each(request.httpRequest.headers, function (key, value) {
    if (key === expiresHeader) key = 'Expires';
    queryParams[key] = value;
  });
  delete request.httpRequest.headers[expiresHeader];

  var auth = queryParams['Authorization'].split(' ');
  if (auth[0] === 'AWS') {
    auth = auth[1].split(':');
    queryParams['AWSAccessKeyId'] = auth[0];
    queryParams['Signature'] = auth[1];
  } else if (auth[0] === 'AWS4-HMAC-SHA256') { // SigV4 signing
    auth.shift();
    var rest = auth.join(' ');
    var signature = rest.match(/Signature=(.*?)(?:,|\s|\r?\n|$)/)[1];
    queryParams['X-Amz-Signature'] = signature;
    delete queryParams['Expires'];
  }
  delete queryParams['Authorization'];
  delete queryParams['Host'];

  endpoint.pathname = parsedUrl.pathname;
  endpoint.search = AWS.util.queryParamsToString(queryParams);
}


AWS.Signers.Presign = inherit({

  sign: function sign(request, expireTime, callback) {
    request.httpRequest.headers[expiresHeader] = expireTime || 3600;
    request.on('build', signedUrlBuilder);
    request.on('sign', signedUrlSigner);
    request.removeListener('afterBuild',
      AWS.EventListeners.Core.SET_CONTENT_LENGTH);
    request.removeListener('afterBuild',
      AWS.EventListeners.Core.COMPUTE_SHA256);

    request.emit('beforePresign', [request]);

    if (callback) {
      request.build(function() {
        if (this.response.error) callback(this.response.error);
        else {
          callback(null, AWS.util.urlFormat(request.httpRequest.endpoint));
        }
      });
    } else {
      request.build();
      if (request.response.error) throw request.response.error;
      return AWS.util.urlFormat(request.httpRequest.endpoint);
    }
  }
});

module.exports = AWS.Signers.Presign;

},{"../core":3}],44:[function(require,module,exports){
var AWS = require('../core');
var inherit = AWS.util.inherit;


AWS.Signers.RequestSigner = inherit({
  constructor: function RequestSigner(request) {
    this.request = request;
  }
});

AWS.Signers.RequestSigner.getVersion = function getVersion(version) {
  switch (version) {
    case 'v2': return AWS.Signers.V2;
    case 'v3': return AWS.Signers.V3;
    case 'v4': return AWS.Signers.V4;
    case 's3': return AWS.Signers.S3;
    case 'v3https': return AWS.Signers.V3Https;
  }
  throw new Error('Unknown signing version ' + version);
};

require('./v2');
require('./v3');
require('./v3https');
require('./v4');
require('./s3');
require('./presign');

},{"../core":3,"./presign":43,"./s3":45,"./v2":46,"./v3":47,"./v3https":48,"./v4":49}],45:[function(require,module,exports){
var AWS = require('../core');
var inherit = AWS.util.inherit;


AWS.Signers.S3 = inherit(AWS.Signers.RequestSigner, {

  subResources: {
    'acl': 1,
    'cors': 1,
    'lifecycle': 1,
    'delete': 1,
    'location': 1,
    'logging': 1,
    'notification': 1,
    'partNumber': 1,
    'policy': 1,
    'requestPayment': 1,
    'restore': 1,
    'tagging': 1,
    'torrent': 1,
    'uploadId': 1,
    'uploads': 1,
    'versionId': 1,
    'versioning': 1,
    'versions': 1,
    'website': 1
  },

  responseHeaders: {
    'response-content-type': 1,
    'response-content-language': 1,
    'response-expires': 1,
    'response-cache-control': 1,
    'response-content-disposition': 1,
    'response-content-encoding': 1
  },

  addAuthorization: function addAuthorization(credentials, date) {
    if (!this.request.headers['presigned-expires']) {
      this.request.headers['X-Amz-Date'] = AWS.util.date.rfc822(date);
    }

    if (credentials.sessionToken) {
      this.request.headers['x-amz-security-token'] = credentials.sessionToken;
    }

    var signature = this.sign(credentials.secretAccessKey, this.stringToSign());
    var auth = 'AWS ' + credentials.accessKeyId + ':' + signature;

    this.request.headers['Authorization'] = auth;
  },

  stringToSign: function stringToSign() {
    var r = this.request;

    var parts = [];
    parts.push(r.method);
    parts.push(r.headers['Content-MD5'] || '');
    parts.push(r.headers['Content-Type'] || '');

    parts.push(r.headers['presigned-expires'] || '');

    var headers = this.canonicalizedAmzHeaders();
    if (headers) parts.push(headers);
    parts.push(this.canonicalizedResource());

    return parts.join('\n');

  },

  canonicalizedAmzHeaders: function canonicalizedAmzHeaders() {

    var amzHeaders = [];

    AWS.util.each(this.request.headers, function (name) {
      if (name.match(/^x-amz-/i))
        amzHeaders.push(name);
    });

    amzHeaders.sort(function (a, b) {
      return a.toLowerCase() < b.toLowerCase() ? -1 : 1;
    });

    var parts = [];
    AWS.util.arrayEach.call(this, amzHeaders, function (name) {
      parts.push(name.toLowerCase() + ':' + String(this.request.headers[name]));
    });

    return parts.join('\n');

  },

  canonicalizedResource: function canonicalizedResource() {

    var r = this.request;

    var parts = r.path.split('?');
    var path = parts[0];
    var querystring = parts[1];

    var resource = '';

    if (r.virtualHostedBucket)
      resource += '/' + r.virtualHostedBucket;

    resource += path;

    if (querystring) {

      var resources = [];

      AWS.util.arrayEach.call(this, querystring.split('&'), function (param) {
        var name = param.split('=')[0];
        var value = param.split('=')[1];
        if (this.subResources[name] || this.responseHeaders[name]) {
          var subresource = { name: name };
          if (value !== undefined) {
            if (this.subResources[name]) {
              subresource.value = value;
            } else {
              subresource.value = decodeURIComponent(value);
            }
          }
          resources.push(subresource);
        }
      });

      resources.sort(function (a, b) { return a.name < b.name ? -1 : 1; });

      if (resources.length) {

        querystring = [];
        AWS.util.arrayEach(resources, function (res) {
          if (res.value === undefined)
            querystring.push(res.name);
          else
            querystring.push(res.name + '=' + res.value);
        });

        resource += '?' + querystring.join('&');
      }

    }

    return resource;

  },

  sign: function sign(secret, string) {
    return AWS.util.crypto.hmac(secret, string, 'base64', 'sha1');
  }
});

module.exports = AWS.Signers.S3;

},{"../core":3}],46:[function(require,module,exports){
var AWS = require('../core');
var inherit = AWS.util.inherit;


AWS.Signers.V2 = inherit(AWS.Signers.RequestSigner, {
  addAuthorization: function addAuthorization(credentials, date) {

    if (!date) date = AWS.util.date.getDate();

    var r = this.request;

    r.params.Timestamp = AWS.util.date.iso8601(date);
    r.params.SignatureVersion = '2';
    r.params.SignatureMethod = 'HmacSHA256';
    r.params.AWSAccessKeyId = credentials.accessKeyId;

    if (credentials.sessionToken) {
      r.params.SecurityToken = credentials.sessionToken;
    }

    delete r.params.Signature; // delete old Signature for re-signing
    r.params.Signature = this.signature(credentials);

    r.body = AWS.util.queryParamsToString(r.params);
    r.headers['Content-Length'] = r.body.length;
  },

  signature: function signature(credentials) {
    return AWS.util.crypto.hmac(credentials.secretAccessKey, this.stringToSign(), 'base64');
  },

  stringToSign: function stringToSign() {
    var parts = [];
    parts.push(this.request.method);
    parts.push(this.request.endpoint.host.toLowerCase());
    parts.push(this.request.pathname());
    parts.push(AWS.util.queryParamsToString(this.request.params));
    return parts.join('\n');
  }

});

module.exports = AWS.Signers.V2;

},{"../core":3}],47:[function(require,module,exports){
var AWS = require('../core');
var inherit = AWS.util.inherit;


AWS.Signers.V3 = inherit(AWS.Signers.RequestSigner, {
  addAuthorization: function addAuthorization(credentials, date) {

    var datetime = AWS.util.date.rfc822(date);

    this.request.headers['X-Amz-Date'] = datetime;

    if (credentials.sessionToken) {
      this.request.headers['x-amz-security-token'] = credentials.sessionToken;
    }

    this.request.headers['X-Amzn-Authorization'] =
      this.authorization(credentials, datetime);

  },

  authorization: function authorization(credentials) {
    return 'AWS3 ' +
      'AWSAccessKeyId=' + credentials.accessKeyId + ',' +
      'Algorithm=HmacSHA256,' +
      'SignedHeaders=' + this.signedHeaders() + ',' +
      'Signature=' + this.signature(credentials);
  },

  signedHeaders: function signedHeaders() {
    var headers = [];
    AWS.util.arrayEach(this.headersToSign(), function iterator(h) {
      headers.push(h.toLowerCase());
    });
    return headers.sort().join(';');
  },

  canonicalHeaders: function canonicalHeaders() {
    var headers = this.request.headers;
    var parts = [];
    AWS.util.arrayEach(this.headersToSign(), function iterator(h) {
      parts.push(h.toLowerCase().trim() + ':' + String(headers[h]).trim());
    });
    return parts.sort().join('\n') + '\n';
  },

  headersToSign: function headersToSign() {
    var headers = [];
    AWS.util.each(this.request.headers, function iterator(k) {
      if (k === 'Host' || k === 'Content-Encoding' || k.match(/^X-Amz/i)) {
        headers.push(k);
      }
    });
    return headers;
  },

  signature: function signature(credentials) {
    return AWS.util.crypto.hmac(credentials.secretAccessKey, this.stringToSign(), 'base64');
  },

  stringToSign: function stringToSign() {
    var parts = [];
    parts.push(this.request.method);
    parts.push('/');
    parts.push('');
    parts.push(this.canonicalHeaders());
    parts.push(this.request.body);
    return AWS.util.crypto.sha256(parts.join('\n'));
  }

});

module.exports = AWS.Signers.V3;

},{"../core":3}],48:[function(require,module,exports){
var AWS = require('../core');
var inherit = AWS.util.inherit;

require('./v3');


AWS.Signers.V3Https = inherit(AWS.Signers.V3, {
  authorization: function authorization(credentials) {
    return 'AWS3-HTTPS ' +
      'AWSAccessKeyId=' + credentials.accessKeyId + ',' +
      'Algorithm=HmacSHA256,' +
      'Signature=' + this.signature(credentials);
  },

  stringToSign: function stringToSign() {
    return this.request.headers['X-Amz-Date'];
  }
});

module.exports = AWS.Signers.V3Https;

},{"../core":3,"./v3":47}],49:[function(require,module,exports){
var AWS = require('../core');
var inherit = AWS.util.inherit;


var cachedSecret = {};


var expiresHeader = 'presigned-expires';


AWS.Signers.V4 = inherit(AWS.Signers.RequestSigner, {
  constructor: function V4(request, serviceName) {
    AWS.Signers.RequestSigner.call(this, request);
    this.serviceName = serviceName;
  },

  algorithm: 'AWS4-HMAC-SHA256',

  addAuthorization: function addAuthorization(credentials, date) {
    var datetime = AWS.util.date.iso8601(date).replace(/[:\-]|\.\d{3}/g, '');

    if (this.isPresigned()) {
      this.updateForPresigned(credentials, datetime);
    } else {
      this.addHeaders(credentials, datetime);
    }

    this.request.headers['Authorization'] =
      this.authorization(credentials, datetime);
  },

  addHeaders: function addHeaders(credentials, datetime) {
    this.request.headers['X-Amz-Date'] = datetime;
    if (credentials.sessionToken) {
      this.request.headers['x-amz-security-token'] = credentials.sessionToken;
    }
  },

  updateForPresigned: function updateForPresigned(credentials, datetime) {
    var credString = this.credentialString(datetime);
    var qs = {
      'X-Amz-Date': datetime,
      'X-Amz-Algorithm': this.algorithm,
      'X-Amz-Credential': credentials.accessKeyId + '/' + credString,
      'X-Amz-Expires': this.request.headers[expiresHeader],
      'X-Amz-SignedHeaders': this.signedHeaders()
    };

    if (credentials.sessionToken) {
      qs['X-Amz-Security-Token'] = credentials.sessionToken;
    }

    if (this.request.headers['Content-Type']) {
      qs['Content-Type'] = this.request.headers['Content-Type'];
    }

    AWS.util.each.call(this, this.request.headers, function(key, value) {
      if (key === expiresHeader) return;
      if (this.isSignableHeader(key) &&
          key.toLowerCase().indexOf('x-amz-') === 0) {
        qs[key] = value;
      }
    });

    var sep = this.request.path.indexOf('?') >= 0 ? '&' : '?';
    this.request.path += sep + AWS.util.queryParamsToString(qs);
  },

  authorization: function authorization(credentials, datetime) {
    var parts = [];
    var credString = this.credentialString(datetime);
    parts.push(this.algorithm + ' Credential=' +
      credentials.accessKeyId + '/' + credString);
    parts.push('SignedHeaders=' + this.signedHeaders());
    parts.push('Signature=' + this.signature(credentials, datetime));
    return parts.join(', ');
  },

  signature: function signature(credentials, datetime) {
    var cache = cachedSecret[this.serviceName];
    var date = datetime.substr(0, 8);
    if (!cache ||
        cache.akid !== credentials.accessKeyId ||
        cache.region !== this.request.region ||
        cache.date !== date) {
      var kSecret = credentials.secretAccessKey;
      var kDate = AWS.util.crypto.hmac('AWS4' + kSecret, date, 'buffer');
      var kRegion = AWS.util.crypto.hmac(kDate, this.request.region, 'buffer');
      var kService = AWS.util.crypto.hmac(kRegion, this.serviceName, 'buffer');
      var kCredentials = AWS.util.crypto.hmac(kService, 'aws4_request', 'buffer');
      cachedSecret[this.serviceName] = {
        region: this.request.region, date: date,
        key: kCredentials, akid: credentials.accessKeyId
      };
    }

    var key = cachedSecret[this.serviceName].key;
    return AWS.util.crypto.hmac(key, this.stringToSign(datetime), 'hex');
  },

  stringToSign: function stringToSign(datetime) {
    var parts = [];
    parts.push('AWS4-HMAC-SHA256');
    parts.push(datetime);
    parts.push(this.credentialString(datetime));
    parts.push(this.hexEncodedHash(this.canonicalString()));
    return parts.join('\n');
  },

  canonicalString: function canonicalString() {
    var parts = [], pathname = this.request.pathname();
    if (this.serviceName !== 's3') pathname = AWS.util.uriEscapePath(pathname);

    parts.push(this.request.method);
    parts.push(pathname);
    parts.push(this.request.search());
    parts.push(this.canonicalHeaders() + '\n');
    parts.push(this.signedHeaders());
    parts.push(this.hexEncodedBodyHash());
    return parts.join('\n');
  },

  canonicalHeaders: function canonicalHeaders() {
    var headers = [];
    AWS.util.each.call(this, this.request.headers, function (key, item) {
      headers.push([key, item]);
    });
    headers.sort(function (a, b) {
      return a[0].toLowerCase() < b[0].toLowerCase() ? -1 : 1;
    });
    var parts = [];
    AWS.util.arrayEach.call(this, headers, function (item) {
      var key = item[0].toLowerCase();
      if (this.isSignableHeader(key)) {
        parts.push(key + ':' +
          this.canonicalHeaderValues(item[1].toString()));
      }
    });
    return parts.join('\n');
  },

  canonicalHeaderValues: function canonicalHeaderValues(values) {
    return values.replace(/\s+/g, ' ').replace(/^\s+|\s+$/g, '');
  },

  signedHeaders: function signedHeaders() {
    var keys = [];
    AWS.util.each.call(this, this.request.headers, function (key) {
      key = key.toLowerCase();
      if (this.isSignableHeader(key)) keys.push(key);
    });
    return keys.sort().join(';');
  },

  credentialString: function credentialString(datetime) {
    var parts = [];
    parts.push(datetime.substr(0, 8));
    parts.push(this.request.region);
    parts.push(this.serviceName);
    parts.push('aws4_request');
    return parts.join('/');
  },

  hexEncodedHash: function hash(string) {
    return AWS.util.crypto.sha256(string, 'hex');
  },

  hexEncodedBodyHash: function hexEncodedBodyHash() {
    if (this.isPresigned() && this.serviceName === 's3') {
      return 'UNSIGNED-PAYLOAD';
    } else if (this.request.headers['X-Amz-Content-Sha256']) {
      return this.request.headers['X-Amz-Content-Sha256'];
    } else {
      return this.hexEncodedHash(this.request.body || '');
    }
  },

  unsignableHeaders: ['authorization', 'content-type', 'content-length',
                      'user-agent', expiresHeader],

  isSignableHeader: function isSignableHeader(key) {
    if (key.toLowerCase().indexOf('x-amz-') === 0) return true;
    return this.unsignableHeaders.indexOf(key) < 0;
  },

  isPresigned: function isPresigned() {
    return this.request.headers[expiresHeader] ? true : false;
  }

});

module.exports = AWS.Signers.V4;

},{"../core":3}],50:[function(require,module,exports){
function AcceptorStateMachine(states, state) {
  this.currentState = state || null;
  this.states = states || {};
}

AcceptorStateMachine.prototype.runTo = function runTo(finalState, done, bindObject, inputError) {
  if (typeof finalState === 'function') {
    inputError = bindObject; bindObject = done;
    done = finalState; finalState = null;
  }

  var self = this;
  var state = self.states[self.currentState];
  state.fn.call(bindObject || self, inputError, function(err) {
    if (err) {
      if (state.fail) self.currentState = state.fail;
      else return done ? done.call(bindObject, err) : null;
    } else {
      if (state.accept) self.currentState = state.accept;
      else return done ? done.call(bindObject) : null;
    }
    if (self.currentState === finalState) {
      return done ? done.call(bindObject, err) : null;
    }

    self.runTo(finalState, done, bindObject, err);
  });
};

AcceptorStateMachine.prototype.addState = function addState(name, acceptState, failState, fn) {
  if (typeof acceptState === 'function') {
    fn = acceptState; acceptState = null; failState = null;
  } else if (typeof failState === 'function') {
    fn = failState; failState = null;
  }

  if (!this.currentState) this.currentState = name;
  this.states[name] = { accept: acceptState, fail: failState, fn: fn };
  return this;
};

module.exports = AcceptorStateMachine;

},{}],51:[function(require,module,exports){
(function (process){


var cryptoLib = require('crypto');
var Buffer = require('buffer').Buffer;
var AWS;


var util = {
  engine: function engine() {
    if (util.isBrowser() && typeof navigator !== 'undefined') {
      return navigator.userAgent;
    } else {
      return process.platform + '/' + process.version;
    }
  },

  userAgent: function userAgent() {
    var name = util.isBrowser() ? 'js' : 'nodejs';
    var agent = 'aws-sdk-' + name + '/' + require('./core').VERSION;
    if (name === 'nodejs') agent += ' ' + util.engine();
    return agent;
  },

  isBrowser: function isBrowser() { return process && process.browser; },
  isNode: function isNode() { return !util.isBrowser(); },
  nodeRequire: function nodeRequire(module) {
    if (util.isNode()) return require(module);
  },
  multiRequire: function multiRequire(module1, module2) {
    return require(util.isNode() ? module1 : module2);
  },

  uriEscape: function uriEscape(string) {
    var output = encodeURIComponent(string);
    output = output.replace(/[^A-Za-z0-9_.~\-%]+/g, escape);

    output = output.replace(/[*]/g, function(ch) {
      return '%' + ch.charCodeAt(0).toString(16).toUpperCase();
    });

    return output;
  },

  uriEscapePath: function uriEscapePath(string) {
    var parts = [];
    util.arrayEach(string.split('/'), function (part) {
      parts.push(util.uriEscape(part));
    });
    return parts.join('/');
  },

  urlParse: function urlParse(url) {
    return require('url').parse(url);
  },

  urlFormat: function urlFormat(url) {
    return require('url').format(url);
  },

  queryStringParse: function queryStringParse(qs) {
    return require('querystring').parse(qs);
  },

  queryParamsToString: function queryParamsToString(params) {
    var items = [];
    var escape = util.uriEscape;
    var sortedKeys = Object.keys(params).sort();

    util.arrayEach(sortedKeys, function(name) {
      var value = params[name];
      var ename = escape(name);
      var result = ename + '=';
      if (Array.isArray(value)) {
        var vals = [];
        util.arrayEach(value, function(item) { vals.push(escape(item)); });
        result = ename + '=' + vals.sort().join('&' + ename + '=');
      } else if (value !== undefined && value !== null) {
        result = ename + '=' + escape(value);
      }
      items.push(result);
    });

    return items.join('&');
  },

  readFileSync: function readFileSync(path) {
    if (typeof window !== 'undefined') return null;
    return util.nodeRequire('fs').readFileSync(path, 'utf-8');
  },

  base64: {

    encode: function encode64(string) {
      return new Buffer(string).toString('base64');
    },

    decode: function decode64(string) {
      return new Buffer(string, 'base64');
    }

  },

  Buffer: Buffer,

  buffer: {
    toStream: function toStream(buffer) {
      if (!util.Buffer.isBuffer(buffer)) buffer = new util.Buffer(buffer);

      var readable = new (util.nodeRequire('stream').Readable)();
      var pos = 0;
      readable._read = function(size) {
        if (pos >= buffer.length) return readable.push(null);

        var end = pos + size;
        if (end > buffer.length) end = buffer.length;
        readable.push(buffer.slice(pos, end));
        pos = end;
      };

      return readable;
    },


    concat: function(buffers) {
      var length = 0,
          offset = 0,
          buffer = null, i;

      for (i = 0; i < buffers.length; i++) {
        length += buffers[i].length;
      }

      buffer = new Buffer(length);

      for (i = 0; i < buffers.length; i++) {
        buffers[i].copy(buffer, offset);
        offset += buffers[i].length;
      }

      return buffer;
    }
  },

  string: {
    byteLength: function byteLength(string) {
      if (string === null || string === undefined) return 0;
      if (typeof string === 'string') string = new Buffer(string);

      if (typeof string.byteLength === 'number') {
        return string.byteLength;
      } else if (typeof string.length === 'number') {
        return string.length;
      } else if (typeof string.size === 'number') {
        return string.size;
      } else if (typeof string.path === 'string') {
        return util.nodeRequire('fs').lstatSync(string.path).size;
      } else {
        throw util.error(new Error('Cannot determine length of ' + string),
          { object: string });
      }
    },

    upperFirst: function upperFirst(string) {
      return string[0].toUpperCase() + string.substr(1);
    },

    lowerFirst: function lowerFirst(string) {
      return string[0].toLowerCase() + string.substr(1);
    }
  },

  ini: {
    parse: function string(ini) {
      var currentSection, map = {};
      util.arrayEach(ini.split(/\r?\n/), function(line) {
        line = line.split(/(^|\s);/)[0]; // remove comments
        var section = line.match(/^\s*\[([^\[\]]+)\]\s*$/);
        if (section) {
          currentSection = section[1];
        } else if (currentSection) {
          var item = line.match(/^\s*(.+?)\s*=\s*(.+?)\s*$/);
          if (item) {
            map[currentSection] = map[currentSection] || {};
            map[currentSection][item[1]] = item[2];
          }
        }
      });

      return map;
    }
  },

  fn: {
    noop: function() {},


    makeAsync: function makeAsync(fn, expectedArgs) {
      if (expectedArgs && expectedArgs <= fn.length) {
        return fn;
      }

      return function() {
        var args = Array.prototype.slice.call(arguments, 0);
        var callback = args.pop();
        var result = fn.apply(null, args);
        callback(result);
      };
    }
  },

  jamespath: {
    query: function query(expression, data) {
      if (!data) return [];

      var results = [];
      var expressions = expression.split(/\s+\|\|\s+/);
      util.arrayEach.call(this, expressions, function (expr) {
        var objects = [data];
        var tokens = expr.split('.');
        util.arrayEach.call(this, tokens, function (token) {
          var match = token.match('^(.+?)(?:\\[(-?\\d+|\\*|)\\])?$');
          var newObjects = [];
          util.arrayEach.call(this, objects, function (obj) {
            if (match[1] === '*') {
              util.arrayEach.call(this, obj, function (value) {
                newObjects.push(value);
              });
            } else if (obj.hasOwnProperty(match[1])) {
              newObjects.push(obj[match[1]]);
            }
          });
          objects = newObjects;

          if (match[2] !== undefined) {
            newObjects = [];
            util.arrayEach.call(this, objects, function (obj) {
              if (Array.isArray(obj)) {
                if (match[2] === '*' || match[2] === '') {
                  newObjects = newObjects.concat(obj);
                } else {
                  var idx = parseInt(match[2], 10);
                  if (idx < 0) idx = obj.length + idx; // negative indexing
                  newObjects.push(obj[idx]);
                }
              }
            });
            objects = newObjects;
          }

          if (objects.length === 0) return util.abort;
        });

        if (objects.length > 0) {
          results = objects;
          return util.abort;
        }
      });

      return results;
    },

    find: function find(expression, data) {
      return util.jamespath.query(expression, data)[0];
    }
  },


  date: {


    getDate: function getDate() {
      if (!AWS) AWS = require('./core');
      if (AWS.config.systemClockOffset) { // use offset when non-zero
        return new Date(new Date().getTime() + AWS.config.systemClockOffset);
      } else {
        return new Date();
      }
    },


    iso8601: function iso8601(date) {
      if (date === undefined) { date = util.date.getDate(); }
      return date.toISOString().replace(/\.\d{3}Z$/, 'Z');
    },


    rfc822: function rfc822(date) {
      if (date === undefined) { date = util.date.getDate(); }
      return date.toUTCString();
    },


    unixTimestamp: function unixTimestamp(date) {
      if (date === undefined) { date = util.date.getDate(); }
      return date.getTime() / 1000;
    },


    from: function format(date) {
      if (typeof date === 'number') {
        return new Date(date * 1000); // unix timestamp
      } else {
        return new Date(date);
      }
    },


    format: function format(date, formatter) {
      if (!formatter) formatter = 'iso8601';
      return util.date[formatter](util.date.from(date));
    },

    parseTimestamp: function parseTimestamp(value) {
      if (typeof value === 'number') { // unix timestamp (number)
        return new Date(value * 1000);
      } else if (value.match(/^\d+$/)) { // unix timestamp
        return new Date(value * 1000);
      } else if (value.match(/^\d{4}/)) { // iso8601
        return new Date(value);
      } else if (value.match(/^\w{3},/)) { // rfc822
        return new Date(value);
      } else {
        throw util.error(
          new Error('unhandled timestamp format: ' + value),
          {code: 'TimestampParserError'});
      }
    }

  },

  crypto: {
    crc32Table: [
     0x00000000, 0x77073096, 0xEE0E612C, 0x990951BA, 0x076DC419,
     0x706AF48F, 0xE963A535, 0x9E6495A3, 0x0EDB8832, 0x79DCB8A4,
     0xE0D5E91E, 0x97D2D988, 0x09B64C2B, 0x7EB17CBD, 0xE7B82D07,
     0x90BF1D91, 0x1DB71064, 0x6AB020F2, 0xF3B97148, 0x84BE41DE,
     0x1ADAD47D, 0x6DDDE4EB, 0xF4D4B551, 0x83D385C7, 0x136C9856,
     0x646BA8C0, 0xFD62F97A, 0x8A65C9EC, 0x14015C4F, 0x63066CD9,
     0xFA0F3D63, 0x8D080DF5, 0x3B6E20C8, 0x4C69105E, 0xD56041E4,
     0xA2677172, 0x3C03E4D1, 0x4B04D447, 0xD20D85FD, 0xA50AB56B,
     0x35B5A8FA, 0x42B2986C, 0xDBBBC9D6, 0xACBCF940, 0x32D86CE3,
     0x45DF5C75, 0xDCD60DCF, 0xABD13D59, 0x26D930AC, 0x51DE003A,
     0xC8D75180, 0xBFD06116, 0x21B4F4B5, 0x56B3C423, 0xCFBA9599,
     0xB8BDA50F, 0x2802B89E, 0x5F058808, 0xC60CD9B2, 0xB10BE924,
     0x2F6F7C87, 0x58684C11, 0xC1611DAB, 0xB6662D3D, 0x76DC4190,
     0x01DB7106, 0x98D220BC, 0xEFD5102A, 0x71B18589, 0x06B6B51F,
     0x9FBFE4A5, 0xE8B8D433, 0x7807C9A2, 0x0F00F934, 0x9609A88E,
     0xE10E9818, 0x7F6A0DBB, 0x086D3D2D, 0x91646C97, 0xE6635C01,
     0x6B6B51F4, 0x1C6C6162, 0x856530D8, 0xF262004E, 0x6C0695ED,
     0x1B01A57B, 0x8208F4C1, 0xF50FC457, 0x65B0D9C6, 0x12B7E950,
     0x8BBEB8EA, 0xFCB9887C, 0x62DD1DDF, 0x15DA2D49, 0x8CD37CF3,
     0xFBD44C65, 0x4DB26158, 0x3AB551CE, 0xA3BC0074, 0xD4BB30E2,
     0x4ADFA541, 0x3DD895D7, 0xA4D1C46D, 0xD3D6F4FB, 0x4369E96A,
     0x346ED9FC, 0xAD678846, 0xDA60B8D0, 0x44042D73, 0x33031DE5,
     0xAA0A4C5F, 0xDD0D7CC9, 0x5005713C, 0x270241AA, 0xBE0B1010,
     0xC90C2086, 0x5768B525, 0x206F85B3, 0xB966D409, 0xCE61E49F,
     0x5EDEF90E, 0x29D9C998, 0xB0D09822, 0xC7D7A8B4, 0x59B33D17,
     0x2EB40D81, 0xB7BD5C3B, 0xC0BA6CAD, 0xEDB88320, 0x9ABFB3B6,
     0x03B6E20C, 0x74B1D29A, 0xEAD54739, 0x9DD277AF, 0x04DB2615,
     0x73DC1683, 0xE3630B12, 0x94643B84, 0x0D6D6A3E, 0x7A6A5AA8,
     0xE40ECF0B, 0x9309FF9D, 0x0A00AE27, 0x7D079EB1, 0xF00F9344,
     0x8708A3D2, 0x1E01F268, 0x6906C2FE, 0xF762575D, 0x806567CB,
     0x196C3671, 0x6E6B06E7, 0xFED41B76, 0x89D32BE0, 0x10DA7A5A,
     0x67DD4ACC, 0xF9B9DF6F, 0x8EBEEFF9, 0x17B7BE43, 0x60B08ED5,
     0xD6D6A3E8, 0xA1D1937E, 0x38D8C2C4, 0x4FDFF252, 0xD1BB67F1,
     0xA6BC5767, 0x3FB506DD, 0x48B2364B, 0xD80D2BDA, 0xAF0A1B4C,
     0x36034AF6, 0x41047A60, 0xDF60EFC3, 0xA867DF55, 0x316E8EEF,
     0x4669BE79, 0xCB61B38C, 0xBC66831A, 0x256FD2A0, 0x5268E236,
     0xCC0C7795, 0xBB0B4703, 0x220216B9, 0x5505262F, 0xC5BA3BBE,
     0xB2BD0B28, 0x2BB45A92, 0x5CB36A04, 0xC2D7FFA7, 0xB5D0CF31,
     0x2CD99E8B, 0x5BDEAE1D, 0x9B64C2B0, 0xEC63F226, 0x756AA39C,
     0x026D930A, 0x9C0906A9, 0xEB0E363F, 0x72076785, 0x05005713,
     0x95BF4A82, 0xE2B87A14, 0x7BB12BAE, 0x0CB61B38, 0x92D28E9B,
     0xE5D5BE0D, 0x7CDCEFB7, 0x0BDBDF21, 0x86D3D2D4, 0xF1D4E242,
     0x68DDB3F8, 0x1FDA836E, 0x81BE16CD, 0xF6B9265B, 0x6FB077E1,
     0x18B74777, 0x88085AE6, 0xFF0F6A70, 0x66063BCA, 0x11010B5C,
     0x8F659EFF, 0xF862AE69, 0x616BFFD3, 0x166CCF45, 0xA00AE278,
     0xD70DD2EE, 0x4E048354, 0x3903B3C2, 0xA7672661, 0xD06016F7,
     0x4969474D, 0x3E6E77DB, 0xAED16A4A, 0xD9D65ADC, 0x40DF0B66,
     0x37D83BF0, 0xA9BCAE53, 0xDEBB9EC5, 0x47B2CF7F, 0x30B5FFE9,
     0xBDBDF21C, 0xCABAC28A, 0x53B39330, 0x24B4A3A6, 0xBAD03605,
     0xCDD70693, 0x54DE5729, 0x23D967BF, 0xB3667A2E, 0xC4614AB8,
     0x5D681B02, 0x2A6F2B94, 0xB40BBE37, 0xC30C8EA1, 0x5A05DF1B,
     0x2D02EF8D],

    crc32: function crc32(data) {
      var tbl = util.crypto.crc32Table;
      var crc = 0 ^ -1;

      if (typeof data === 'string') {
        data = new Buffer(data);
      }

      for (var i = 0; i < data.length; i++) {
        var code = data.readUInt8(i);
        crc = (crc >>> 8) ^ tbl[(crc ^ code) & 0xFF];
      }
      return (crc ^ -1) >>> 0;
    },

    hmac: function hmac(key, string, digest, fn) {
      if (!digest) digest = 'binary';
      if (digest === 'buffer') { digest = undefined; }
      if (!fn) fn = 'sha256';
      if (typeof string === 'string') string = new Buffer(string);
      return cryptoLib.createHmac(fn, key).update(string).digest(digest);
    },

    md5: function md5(data, digest, callback) {
      return util.crypto.hash('md5', data, digest, callback);
    },

    sha256: function sha256(data, digest, callback) {
      return util.crypto.hash('sha256', data, digest, callback);
    },

    hash: function(algorithm, data, digest, callback) {
      var hash = util.crypto.createHash(algorithm);
      if (!digest) { digest = 'binary'; }
      if (digest === 'buffer') { digest = undefined; }
      if (typeof data === 'string') data = new Buffer(data);
      var sliceFn = util.arraySliceFn(data);
      var isBuffer = Buffer.isBuffer(data);

      if (callback && typeof data === 'object' &&
          typeof data.on === 'function' && !isBuffer) {
        data.on('data', function(chunk) { hash.update(chunk); });
        data.on('error', function(err) { callback(err); });
        data.on('end', function() { callback(null, hash.digest(digest)); });
      } else if (callback && sliceFn && !isBuffer &&
                 typeof FileReader !== 'undefined') {
        var index = 0, size = 1024 * 512;
        var reader = new FileReader();
        reader.onerror = function() {
          callback(new Error('Failed to read data.'));
        };
        reader.onload = function() {
          var buf = new Buffer(new Uint8Array(reader.result));
          hash.update(buf);
          index += buf.length;
          reader._continueReading();
        };
        reader._continueReading = function() {
          if (index >= data.size) {
            callback(null, hash.digest(digest));
            return;
          }

          var back = index + size;
          if (back > data.size) back = data.size;
          reader.readAsArrayBuffer(sliceFn.call(data, index, back));
        };

        reader._continueReading();
      } else {
        if (util.isBrowser() && typeof data === 'object' && !isBuffer) {
          data = new Buffer(new Uint8Array(data));
        }
        var out = hash.update(data).digest(digest);
        if (callback) callback(null, out);
        return out;
      }
    },

    toHex: function toHex(data) {
      var out = [];
      for (var i = 0; i < data.length; i++) {
        out.push(('0' + data.charCodeAt(i).toString(16)).substr(-2, 2));
      }
      return out.join('');
    },

    createHash: function createHash(algorithm) {
      return cryptoLib.createHash(algorithm);
    }

  },




  abort: {},

  each: function each(object, iterFunction) {
    for (var key in object) {
      if (object.hasOwnProperty(key)) {
        var ret = iterFunction.call(this, key, object[key]);
        if (ret === util.abort) break;
      }
    }
  },

  arrayEach: function arrayEach(array, iterFunction) {
    for (var idx in array) {
      if (array.hasOwnProperty(idx)) {
        var ret = iterFunction.call(this, array[idx], parseInt(idx, 10));
        if (ret === util.abort) break;
      }
    }
  },

  update: function update(obj1, obj2) {
    util.each(obj2, function iterator(key, item) {
      obj1[key] = item;
    });
    return obj1;
  },

  merge: function merge(obj1, obj2) {
    return util.update(util.copy(obj1), obj2);
  },

  copy: function copy(object) {
    if (object === null || object === undefined) return object;
    var dupe = {};
    for (var key in object) {
      dupe[key] = object[key];
    }
    return dupe;
  },

  isEmpty: function isEmpty(obj) {
    for (var prop in obj) {
      if (obj.hasOwnProperty(prop)) {
        return false;
      }
    }
    return true;
  },

  arraySliceFn: function arraySliceFn(obj) {
    var fn = obj.slice || obj.webkitSlice || obj.mozSlice;
    return typeof fn === 'function' ? fn : null;
  },

  isType: function isType(obj, type) {
    if (typeof type === 'function') type = util.typeName(type);
    return Object.prototype.toString.call(obj) === '[object ' + type + ']';
  },

  typeName: function typeName(type) {
    if (type.hasOwnProperty('name')) return type.name;
    var str = type.toString();
    var match = str.match(/^\s*function (.+)\(/);
    return match ? match[1] : str;
  },

  error: function error(err, options) {
    var originalError = null;
    if (typeof err.message === 'string' && err.message !== '') {
      if (typeof options === 'string' || (options && options.message)) {
        originalError = util.copy(err);
        originalError.message = err.message;
      }
    }
    err.message = err.message || null;

    if (typeof options === 'string') {
      err.message = options;
    } else if (typeof options === 'object') {
      util.update(err, options);
      if (options.message)
        err.message = options.message;
      if (options.code || options.name)
        err.code = options.code || options.name;
      if (options.stack)
        err.stack = options.stack;
    }

    if (typeof Object.defineProperty === 'function') {
      Object.defineProperty(err, 'name', {writable: true, enumerable: false});
      Object.defineProperty(err, 'message', {enumerable: true});
    }

    err.name = options && options.name || err.name || err.code || 'Error';
    err.time = new Date();

    if (originalError) err.originalError = originalError;

    return err;
  },


  inherit: function inherit(klass, features) {
    var newObject = null;
    if (features === undefined) {
      features = klass;
      klass = Object;
      newObject = {};
    } else {
      var ctor = function ConstructorWrapper() {};
      ctor.prototype = klass.prototype;
      newObject = new ctor();
    }

    if (features.constructor === Object) {
      features.constructor = function() {
        if (klass !== Object) {
          return klass.apply(this, arguments);
        }
      };
    }

    features.constructor.prototype = newObject;
    util.update(features.constructor.prototype, features);
    features.constructor.__super__ = klass;
    return features.constructor;
  },


  mixin: function mixin() {
    var klass = arguments[0];
    for (var i = 1; i < arguments.length; i++) {
      for (var prop in arguments[i].prototype) {
        var fn = arguments[i].prototype[prop];
        if (prop !== 'constructor') {
          klass.prototype[prop] = fn;
        }
      }
    }
    return klass;
  },


  hideProperties: function hideProperties(obj, props) {
    if (typeof Object.defineProperty !== 'function') return;

    util.arrayEach(props, function (key) {
      Object.defineProperty(obj, key, {
        enumerable: false, writable: true, configurable: true });
    });
  },


  property: function property(obj, name, value, enumerable, isValue) {
    var opts = {
      configurable: true,
      enumerable: enumerable !== undefined ? enumerable : true
    };
    if (typeof value === 'function' && !isValue) {
      opts.get = value;
    }
    else {
      opts.value = value; opts.writable = true;
    }

    Object.defineProperty(obj, name, opts);
  },


  memoizedProperty: function memoizedProperty(obj, name, get, enumerable) {
    var cachedValue = null;

    util.property(obj, name, function() {
      if (cachedValue === null) {
        cachedValue = get();
      }
      return cachedValue;
    }, enumerable);
  },


  hoistPayloadMember: function hoistPayloadMember(resp) {
    var req = resp.request;
    var operation = req.operation;
    var output = req.service.api.operations[operation].output;
    if (output.payload) {
      var payloadMember = output.members[output.payload];
      var responsePayload = resp.data[output.payload];
      if (payloadMember.type === 'structure') {
        util.each(responsePayload, function(key, value) {
          util.property(resp.data, key, value, false);
        });
      }
    }
  },


  computeSha256: function computeSha256(body, done) {
    if (util.isNode()) {
      var Stream = util.nodeRequire('stream').Stream;
      var fs = util.nodeRequire('fs');
      if (body instanceof Stream) {
        if (typeof body.path === 'string') { // assume file object
          body = fs.createReadStream(body.path);
        } else { // TODO support other stream types
          return done(new Error('Non-file stream objects are ' +
                                'not supported with SigV4'));
        }
      }
    }

    util.crypto.sha256(body, 'hex', function(err, sha) {
      if (err) done(err);
      else done(null, sha);
    });
  }

};

module.exports = util;

}).call(this,require("FWaASH"))
},{"./core":3,"FWaASH":65,"buffer":54,"crypto":58,"querystring":69,"url":70}],52:[function(require,module,exports){
var util = require('../util');
var Shape = require('../model/shape');

function DomXmlParser() { }

DomXmlParser.prototype.parse = function(xml, shape) {
  if (xml.replace(/^\s+/, '') === '') return {};

  var result, error;
  try {
    if (window.DOMParser) {
      try {
        var parser = new DOMParser();
        result = parser.parseFromString(xml, 'text/xml');
      } catch (syntaxError) {
        throw util.error(new Error('Parse error in document'),
          {originalError: syntaxError});
      }

      if (result.documentElement === null) {
        throw new Error('Cannot parse empty document.');
      }

      var isError = result.getElementsByTagName('parsererror')[0];
      if (isError && (isError.parentNode === result ||
          isError.parentNode.nodeName === 'body')) {
        throw new Error(isError.getElementsByTagName('div')[0].textContent);
      }
    } else if (window.ActiveXObject) {
      result = new window.ActiveXObject('Microsoft.XMLDOM');
      result.async = false;

      if (!result.loadXML(xml)) {
        throw new Error('Parse error in document');
      }
    } else {
      throw new Error('Cannot load XML parser');
    }
  } catch (e) {
    error = e;
  }

  if (result && result.documentElement && !error) {
    var data = parseXml(result.documentElement, shape);
    var metadata = result.getElementsByTagName('ResponseMetadata')[0];
    if (metadata) {
      data.ResponseMetadata = parseXml(metadata, {});
    }
    return data;
  } else if (error) {
    throw util.error(error || new Error(), {code: 'XMLParserError'});
  } else { // empty xml document
    return {};
  }
};

function parseXml(xml, shape) {
  if (!shape) shape = {};
  switch (shape.type) {
    case 'structure': return parseStructure(xml, shape);
    case 'map': return parseMap(xml, shape);
    case 'list': return parseList(xml, shape);
    case undefined: case null: return parseUnknown(xml);
    default: return parseScalar(xml, shape);
  }
}

function parseStructure(xml, shape) {
  var data = {};
  if (xml === null) return data;

  util.each(shape.members, function(memberName, memberShape) {
    if (memberShape.isXmlAttribute) {
      if (xml.attributes.hasOwnProperty(memberShape.name)) {
        var value = xml.attributes[memberShape.name].value;
        data[memberName] = parseXml({textContent: value}, memberShape);
      }
    } else {
      var xmlChild = memberShape.flattened ? xml :
        xml.getElementsByTagName(memberShape.name)[0];
      if (xmlChild) {
        data[memberName] = parseXml(xmlChild, memberShape);
      } else if (!memberShape.flattened && memberShape.type === 'list') {
        data[memberName] = memberShape.defaultValue;
      }
    }
  });

  return data;
}

function parseMap(xml, shape) {
  var data = {};
  var xmlKey = shape.key.name || 'key';
  var xmlValue = shape.value.name || 'value';
  var tagName = shape.flattened ? shape.name : 'entry';

  var child = xml.firstElementChild;
  while (child) {
    if (child.nodeName === tagName) {
      var key = child.getElementsByTagName(xmlKey)[0].textContent;
      var value = child.getElementsByTagName(xmlValue)[0];
      data[key] = parseXml(value, shape.value);
    }
    child = child.nextElementSibling;
  }
  return data;
}

function parseList(xml, shape) {
  var data = [];
  var tagName = shape.flattened ? shape.name : (shape.member.name || 'member');

  var child = xml.firstElementChild;
  while (child) {
    if (child.nodeName === tagName) {
      data.push(parseXml(child, shape.member));
    }
    child = child.nextElementSibling;
  }
  return data;
}

function parseScalar(xml, shape) {
  if (xml.getAttribute) {
    var encoding = xml.getAttribute('encoding');
    if (encoding === 'base64') {
      shape = new Shape.create({type: encoding});
    }
  }

  var text = xml.textContent;
  if (text === '') text = null;
  if (typeof shape.toType === 'function') {
    return shape.toType(text);
  } else {
    return text;
  }
}

function parseUnknown(xml) {
  if (xml === undefined || xml === null) return '';

  if (!xml.firstElementChild) {
    if (xml.parentNode.parentNode === null) return {};
    if (xml.childNodes.length === 0) return '';
    else return xml.textContent;
  }

  var shape = {type: 'structure', members: {}};
  var child = xml.firstElementChild;
  while (child) {
    var tag = child.nodeName;
    if (shape.members.hasOwnProperty(tag)) {
      shape.members[tag].type = 'list';
    } else {
      shape.members[tag] = {name: tag};
    }
    child = child.nextElementSibling;
  }
  return parseStructure(xml, shape);
}

module.exports = DomXmlParser;

},{"../model/shape":20,"../util":51}],53:[function(require,module,exports){
var util = require('../util');
var builder = require('xmlbuilder');

function XmlBuilder() { }

XmlBuilder.prototype.toXML = function(params, shape, rootElement, noEmpty) {
  var xml = builder.create(rootElement);
  applyNamespaces(xml, shape);
  serialize(xml, params, shape);
  return xml.children.length > 0 || noEmpty ? xml.root().toString() : '';
};

function serialize(xml, value, shape) {
  switch (shape.type) {
    case 'structure': return serializeStructure(xml, value, shape);
    case 'map': return serializeMap(xml, value, shape);
    case 'list': return serializeList(xml, value, shape);
    default: return serializeScalar(xml, value, shape);
  }
}

function serializeStructure(xml, params, shape) {
  util.arrayEach(shape.memberNames, function(memberName) {
    var memberShape = shape.members[memberName];
    if (memberShape.location !== 'body') return;

    var value = params[memberName];
    var name = memberShape.name;
    if (value !== undefined && value !== null) {
      if (memberShape.isXmlAttribute) {
        xml.att(name, value);
      } else if (memberShape.flattened) {
        serialize(xml, value, memberShape);
      } else {
        var element = xml.ele(name);
        applyNamespaces(element, memberShape);
        serialize(element, value, memberShape);
      }
    }
  });
}

function serializeMap(xml, map, shape) {
  var xmlKey = shape.key.name || 'key';
  var xmlValue = shape.value.name || 'value';

  util.each(map, function(key, value) {
    var entry = xml.ele(shape.flattened ? shape.name : 'entry');
    serialize(entry.ele(xmlKey), key, shape.key);
    serialize(entry.ele(xmlValue), value, shape.value);
  });
}

function serializeList(xml, list, shape) {
  if (shape.flattened) {
    util.arrayEach(list, function(value) {
      var name = shape.member.name || shape.name;
      var element = xml.ele(name);
      serialize(element, value, shape.member);
    });
  } else {
    util.arrayEach(list, function(value) {
      var name = shape.member.name || 'member';
      var element = xml.ele(name);
      serialize(element, value, shape.member);
    });
  }
}

function serializeScalar(xml, value, shape) {
  xml.txt(shape.toWireFormat(value));
}

function applyNamespaces(xml, shape) {
  var uri, prefix = 'xmlns';
  if (shape.xmlNamespaceUri) {
    uri = shape.xmlNamespaceUri;
    if (shape.xmlNamespacePrefix) prefix += ':' + shape.xmlNamespacePrefix;
  } else if (xml.isRoot && shape.api.xmlNamespaceUri) {
    uri = shape.api.xmlNamespaceUri;
  }

  if (uri) xml.att(prefix, uri);
}

module.exports = XmlBuilder;

},{"../util":51,"xmlbuilder":75}],54:[function(require,module,exports){


var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = Buffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192


Buffer._useTypedArrays = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() &&
        typeof arr.subarray === 'function' // Chrome 9-10 lack `subarray`
  } catch (e) {
    return false
  }
})()


function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  if (encoding === 'base64' && type === 'string') {
    subject = stringtrim(subject)
    while (subject.length % 4 !== 0) {
      subject = subject + '='
    }
  }

  var length
  if (type === 'number')
    length = coerce(subject)
  else if (type === 'string')
    length = Buffer.byteLength(subject, encoding)
  else if (type === 'object')
    length = coerce(subject.length) // assume that object is array-like
  else
    throw new Error('First argument needs to be a number, array or string.')

  var buf
  if (Buffer._useTypedArrays) {
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer._useTypedArrays && typeof subject.byteLength === 'number') {
    buf._set(subject)
  } else if (isArrayish(subject)) {
    for (i = 0; i < length; i++) {
      if (Buffer.isBuffer(subject))
        buf[i] = subject.readUInt8(i)
      else
        buf[i] = subject[i]
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer._useTypedArrays && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  return buf
}


Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.isBuffer = function (b) {
  return !!(b !== null && b !== undefined && b._isBuffer)
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'hex':
      ret = str.length / 2
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.concat = function (list, totalLength) {
  assert(isArray(list), 'Usage: Buffer.concat(list, [totalLength])\n' +
      'list should be an Array.')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}


function _hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length
  assert(strLen % 2 === 0, 'Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    assert(!isNaN(byte), 'Invalid hex string')
    buf[offset + i] = byte
  }
  Buffer._charsWritten = i * 2
  return i
}

function _utf8Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf8ToBytes(string), buf, offset, length)
  return charsWritten
}

function _asciiWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function _binaryWrite (buf, string, offset, length) {
  return _asciiWrite(buf, string, offset, length)
}

function _base64Write (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function _utf16leWrite (buf, string, offset, length) {
  var charsWritten = Buffer._charsWritten =
    blitBuffer(utf16leToBytes(string), buf, offset, length)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0
  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = _asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = _binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = _base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leWrite(this, string, offset, length)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toString = function (encoding, start, end) {
  var self = this

  encoding = String(encoding || 'utf8').toLowerCase()
  start = Number(start) || 0
  end = (end !== undefined)
    ? Number(end)
    : end = self.length

  if (end === start)
    return ''

  var ret
  switch (encoding) {
    case 'hex':
      ret = _hexSlice(self, start, end)
      break
    case 'utf8':
    case 'utf-8':
      ret = _utf8Slice(self, start, end)
      break
    case 'ascii':
      ret = _asciiSlice(self, start, end)
      break
    case 'binary':
      ret = _binarySlice(self, start, end)
      break
    case 'base64':
      ret = _base64Slice(self, start, end)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = _utf16leSlice(self, start, end)
      break
    default:
      throw new Error('Unknown encoding')
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (!target_start) target_start = 0

  if (end === start) return
  if (target.length === 0 || source.length === 0) return

  assert(end >= start, 'sourceEnd < sourceStart')
  assert(target_start >= 0 && target_start < target.length,
      'targetStart out of bounds')
  assert(start >= 0 && start < source.length, 'sourceStart out of bounds')
  assert(end >= 0 && end <= source.length, 'sourceEnd out of bounds')

  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 100 || !Buffer._useTypedArrays) {
    for (var i = 0; i < len; i++)
      target[i + target_start] = this[i + start]
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }
}

function _base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function _utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function _asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++)
    ret += String.fromCharCode(buf[i])
  return ret
}

function _binarySlice (buf, start, end) {
  return _asciiSlice(buf, start, end)
}

function _hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function _utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i+1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = clamp(start, len, 0)
  end = clamp(end, len, len)

  if (Buffer._useTypedArrays) {
    return Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    var newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
    return newBuf
  }
}

Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  return this[offset]
}

function _readUInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    val = buf[offset]
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
  } else {
    val = buf[offset] << 8
    if (offset + 1 < len)
      val |= buf[offset + 1]
  }
  return val
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  return _readUInt16(this, offset, true, noAssert)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  return _readUInt16(this, offset, false, noAssert)
}

function _readUInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val
  if (littleEndian) {
    if (offset + 2 < len)
      val = buf[offset + 2] << 16
    if (offset + 1 < len)
      val |= buf[offset + 1] << 8
    val |= buf[offset]
    if (offset + 3 < len)
      val = val + (buf[offset + 3] << 24 >>> 0)
  } else {
    if (offset + 1 < len)
      val = buf[offset + 1] << 16
    if (offset + 2 < len)
      val |= buf[offset + 2] << 8
    if (offset + 3 < len)
      val |= buf[offset + 3]
    val = val + (buf[offset] << 24 >>> 0)
  }
  return val
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  return _readUInt32(this, offset, true, noAssert)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  return _readUInt32(this, offset, false, noAssert)
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert) {
    assert(offset !== undefined && offset !== null,
        'missing offset')
    assert(offset < this.length, 'Trying to read beyond buffer length')
  }

  if (offset >= this.length)
    return

  var neg = this[offset] & 0x80
  if (neg)
    return (0xff - this[offset] + 1) * -1
  else
    return this[offset]
}

function _readInt16 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt16(buf, offset, littleEndian, true)
  var neg = val & 0x8000
  if (neg)
    return (0xffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  return _readInt16(this, offset, true, noAssert)
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  return _readInt16(this, offset, false, noAssert)
}

function _readInt32 (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  var len = buf.length
  if (offset >= len)
    return

  var val = _readUInt32(buf, offset, littleEndian, true)
  var neg = val & 0x80000000
  if (neg)
    return (0xffffffff - val + 1) * -1
  else
    return val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  return _readInt32(this, offset, true, noAssert)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  return _readInt32(this, offset, false, noAssert)
}

function _readFloat (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 3 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 23, 4)
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  return _readFloat(this, offset, true, noAssert)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  return _readFloat(this, offset, false, noAssert)
}

function _readDouble (buf, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset + 7 < buf.length, 'Trying to read beyond buffer length')
  }

  return ieee754.read(buf, offset, littleEndian, 52, 8)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  return _readDouble(this, offset, true, noAssert)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  return _readDouble(this, offset, false, noAssert)
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'trying to write beyond buffer length')
    verifuint(value, 0xff)
  }

  if (offset >= this.length) return

  this[offset] = value
}

function _writeUInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 2); i < j; i++) {
    buf[offset + i] =
        (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
            (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  _writeUInt16(this, value, offset, false, noAssert)
}

function _writeUInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'trying to write beyond buffer length')
    verifuint(value, 0xffffffff)
  }

  var len = buf.length
  if (offset >= len)
    return

  for (var i = 0, j = Math.min(len - offset, 4); i < j; i++) {
    buf[offset + i] =
        (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  _writeUInt32(this, value, offset, false, noAssert)
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset < this.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7f, -0x80)
  }

  if (offset >= this.length)
    return

  if (value >= 0)
    this.writeUInt8(value, offset, noAssert)
  else
    this.writeUInt8(0xff + value + 1, offset, noAssert)
}

function _writeInt16 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 1 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fff, -0x8000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt16(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt16(buf, 0xffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  _writeInt16(this, value, offset, false, noAssert)
}

function _writeInt32 (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifsint(value, 0x7fffffff, -0x80000000)
  }

  var len = buf.length
  if (offset >= len)
    return

  if (value >= 0)
    _writeUInt32(buf, value, offset, littleEndian, noAssert)
  else
    _writeUInt32(buf, 0xffffffff + value + 1, offset, littleEndian, noAssert)
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, true, noAssert)
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  _writeInt32(this, value, offset, false, noAssert)
}

function _writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 3 < buf.length, 'Trying to write beyond buffer length')
    verifIEEE754(value, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 23, 4)
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  _writeFloat(this, value, offset, false, noAssert)
}

function _writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert) {
    assert(value !== undefined && value !== null, 'missing value')
    assert(typeof littleEndian === 'boolean', 'missing or invalid endian')
    assert(offset !== undefined && offset !== null, 'missing offset')
    assert(offset + 7 < buf.length,
        'Trying to write beyond buffer length')
    verifIEEE754(value, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }

  var len = buf.length
  if (offset >= len)
    return

  ieee754.write(buf, value, offset, littleEndian, 52, 8)
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  _writeDouble(this, value, offset, false, noAssert)
}

Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (typeof value === 'string') {
    value = value.charCodeAt(0)
  }

  assert(typeof value === 'number' && !isNaN(value), 'value is not a number')
  assert(end >= start, 'end < start')

  if (end === start) return
  if (this.length === 0) return

  assert(start >= 0 && start < this.length, 'start out of bounds')
  assert(end >= 0 && end <= this.length, 'end out of bounds')

  for (var i = start; i < end; i++) {
    this[i] = value
  }
}

Buffer.prototype.inspect = function () {
  var out = []
  var len = this.length
  for (var i = 0; i < len; i++) {
    out[i] = toHex(this[i])
    if (i === exports.INSPECT_MAX_BYTES) {
      out[i + 1] = '...'
      break
    }
  }
  return '<Buffer ' + out.join(' ') + '>'
}


Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer._useTypedArrays) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1)
        buf[i] = this[i]
      return buf.buffer
    }
  } else {
    throw new Error('Buffer.toArrayBuffer not supported in this browser')
  }
}


function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

var BP = Buffer.prototype


Buffer._augment = function (arr) {
  arr._isBuffer = true

  arr._get = arr.get
  arr._set = arr.set

  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

function clamp (index, len, defaultValue) {
  if (typeof index !== 'number') return defaultValue
  index = ~~index;  // Coerce to integer.
  if (index >= len) return len
  if (index >= 0) return index
  index += len
  if (index >= 0) return index
  return 0
}

function coerce (length) {
  length = ~~Math.ceil(+length)
  return length < 0 ? 0 : length
}

function isArray (subject) {
  return (Array.isArray || function (subject) {
    return Object.prototype.toString.call(subject) === '[object Array]'
  })(subject)
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    var b = str.charCodeAt(i)
    if (b <= 0x7F)
      byteArray.push(str.charCodeAt(i))
    else {
      var start = i
      if (b >= 0xD800 && b <= 0xDFFF) i++
      var h = encodeURIComponent(str.slice(start, i+1)).substr(1).split('%')
      for (var j = 0; j < h.length; j++)
        byteArray.push(parseInt(h[j], 16))
    }
  }
  return byteArray
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(str)
}

function blitBuffer (src, dst, offset, length) {
  var pos
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}


function verifuint (value, max) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value >= 0, 'specified a negative value for writing an unsigned value')
  assert(value <= max, 'value is larger than maximum value for type')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifsint (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
  assert(Math.floor(value) === value, 'value has a fractional component')
}

function verifIEEE754 (value, max, min) {
  assert(typeof value === 'number', 'cannot write a non-number as a number')
  assert(value <= max, 'value larger than maximum allowed value')
  assert(value >= min, 'value smaller than minimum allowed value')
}

function assert (test, message) {
  if (!test) throw new Error(message || 'Failed assertion')
}

},{"base64-js":55,"ieee754":56}],55:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],56:[function(require,module,exports){
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = nBytes * 8 - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],57:[function(require,module,exports){
var Buffer = require('buffer').Buffer;
var intSize = 4;
var zeroBuffer = new Buffer(intSize); zeroBuffer.fill(0);
var chrsz = 8;

function toArray(buf, bigEndian) {
  if ((buf.length % intSize) !== 0) {
    var len = buf.length + (intSize - (buf.length % intSize));
    buf = Buffer.concat([buf, zeroBuffer], len);
  }

  var arr = [];
  var fn = bigEndian ? buf.readInt32BE : buf.readInt32LE;
  for (var i = 0; i < buf.length; i += intSize) {
    arr.push(fn.call(buf, i));
  }
  return arr;
}

function toBuffer(arr, size, bigEndian) {
  var buf = new Buffer(size);
  var fn = bigEndian ? buf.writeInt32BE : buf.writeInt32LE;
  for (var i = 0; i < arr.length; i++) {
    fn.call(buf, arr[i], i * 4, true);
  }
  return buf;
}

function hash(buf, fn, hashSize, bigEndian) {
  if (!Buffer.isBuffer(buf)) buf = new Buffer(buf);
  var arr = fn(toArray(buf, bigEndian), buf.length * chrsz);
  return toBuffer(arr, hashSize, bigEndian);
}

module.exports = { hash: hash };

},{"buffer":54}],58:[function(require,module,exports){
var Buffer = require('buffer').Buffer
var sha = require('./sha')
var sha256 = require('./sha256')
var rng = require('./rng')
var md5 = require('./md5')

var algorithms = {
  sha1: sha,
  sha256: sha256,
  md5: md5
}

var blocksize = 64
var zeroBuffer = new Buffer(blocksize); zeroBuffer.fill(0)
function hmac(fn, key, data) {
  if(!Buffer.isBuffer(key)) key = new Buffer(key)
  if(!Buffer.isBuffer(data)) data = new Buffer(data)

  if(key.length > blocksize) {
    key = fn(key)
  } else if(key.length < blocksize) {
    key = Buffer.concat([key, zeroBuffer], blocksize)
  }

  var ipad = new Buffer(blocksize), opad = new Buffer(blocksize)
  for(var i = 0; i < blocksize; i++) {
    ipad[i] = key[i] ^ 0x36
    opad[i] = key[i] ^ 0x5C
  }

  var hash = fn(Buffer.concat([ipad, data]))
  return fn(Buffer.concat([opad, hash]))
}

function hash(alg, key) {
  alg = alg || 'sha1'
  var fn = algorithms[alg]
  var bufs = []
  var length = 0
  if(!fn) error('algorithm:', alg, 'is not yet supported')
  return {
    update: function (data) {
      if(!Buffer.isBuffer(data)) data = new Buffer(data)
        
      bufs.push(data)
      length += data.length
      return this
    },
    digest: function (enc) {
      var buf = Buffer.concat(bufs)
      var r = key ? hmac(fn, key, buf) : fn(buf)
      bufs = null
      return enc ? r.toString(enc) : r
    }
  }
}

function error () {
  var m = [].slice.call(arguments).join(' ')
  throw new Error([
    m,
    'we accept pull requests',
    'http://github.com/dominictarr/crypto-browserify'
    ].join('\n'))
}

exports.createHash = function (alg) { return hash(alg) }
exports.createHmac = function (alg, key) { return hash(alg, key) }
exports.randomBytes = function(size, callback) {
  if (callback && callback.call) {
    try {
      callback.call(this, undefined, new Buffer(rng(size)))
    } catch (err) { callback(err) }
  } else {
    return new Buffer(rng(size))
  }
}

function each(a, f) {
  for(var i in a)
    f(a[i], i)
}

each(['createCredentials'
, 'createCipher'
, 'createCipheriv'
, 'createDecipher'
, 'createDecipheriv'
, 'createSign'
, 'createVerify'
, 'createDiffieHellman'
, 'pbkdf2'], function (name) {
  exports[name] = function () {
    error('sorry,', name, 'is not implemented yet')
  }
})

},{"./md5":59,"./rng":60,"./sha":61,"./sha256":62,"buffer":54}],59:[function(require,module,exports){


var helpers = require('./helpers');


function md5_vm_test()
{
  return hex_md5("abc") == "900150983cd24fb0d6963f7d28e17f72";
}


function core_md5(x, len)
{

  x[len >> 5] |= 0x80 << ((len) % 32);
  x[(((len + 64) >>> 9) << 4) + 14] = len;

  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;

    a = md5_ff(a, b, c, d, x[i+ 0], 7 , -680876936);
    d = md5_ff(d, a, b, c, x[i+ 1], 12, -389564586);
    c = md5_ff(c, d, a, b, x[i+ 2], 17,  606105819);
    b = md5_ff(b, c, d, a, x[i+ 3], 22, -1044525330);
    a = md5_ff(a, b, c, d, x[i+ 4], 7 , -176418897);
    d = md5_ff(d, a, b, c, x[i+ 5], 12,  1200080426);
    c = md5_ff(c, d, a, b, x[i+ 6], 17, -1473231341);
    b = md5_ff(b, c, d, a, x[i+ 7], 22, -45705983);
    a = md5_ff(a, b, c, d, x[i+ 8], 7 ,  1770035416);
    d = md5_ff(d, a, b, c, x[i+ 9], 12, -1958414417);
    c = md5_ff(c, d, a, b, x[i+10], 17, -42063);
    b = md5_ff(b, c, d, a, x[i+11], 22, -1990404162);
    a = md5_ff(a, b, c, d, x[i+12], 7 ,  1804603682);
    d = md5_ff(d, a, b, c, x[i+13], 12, -40341101);
    c = md5_ff(c, d, a, b, x[i+14], 17, -1502002290);
    b = md5_ff(b, c, d, a, x[i+15], 22,  1236535329);

    a = md5_gg(a, b, c, d, x[i+ 1], 5 , -165796510);
    d = md5_gg(d, a, b, c, x[i+ 6], 9 , -1069501632);
    c = md5_gg(c, d, a, b, x[i+11], 14,  643717713);
    b = md5_gg(b, c, d, a, x[i+ 0], 20, -373897302);
    a = md5_gg(a, b, c, d, x[i+ 5], 5 , -701558691);
    d = md5_gg(d, a, b, c, x[i+10], 9 ,  38016083);
    c = md5_gg(c, d, a, b, x[i+15], 14, -660478335);
    b = md5_gg(b, c, d, a, x[i+ 4], 20, -405537848);
    a = md5_gg(a, b, c, d, x[i+ 9], 5 ,  568446438);
    d = md5_gg(d, a, b, c, x[i+14], 9 , -1019803690);
    c = md5_gg(c, d, a, b, x[i+ 3], 14, -187363961);
    b = md5_gg(b, c, d, a, x[i+ 8], 20,  1163531501);
    a = md5_gg(a, b, c, d, x[i+13], 5 , -1444681467);
    d = md5_gg(d, a, b, c, x[i+ 2], 9 , -51403784);
    c = md5_gg(c, d, a, b, x[i+ 7], 14,  1735328473);
    b = md5_gg(b, c, d, a, x[i+12], 20, -1926607734);

    a = md5_hh(a, b, c, d, x[i+ 5], 4 , -378558);
    d = md5_hh(d, a, b, c, x[i+ 8], 11, -2022574463);
    c = md5_hh(c, d, a, b, x[i+11], 16,  1839030562);
    b = md5_hh(b, c, d, a, x[i+14], 23, -35309556);
    a = md5_hh(a, b, c, d, x[i+ 1], 4 , -1530992060);
    d = md5_hh(d, a, b, c, x[i+ 4], 11,  1272893353);
    c = md5_hh(c, d, a, b, x[i+ 7], 16, -155497632);
    b = md5_hh(b, c, d, a, x[i+10], 23, -1094730640);
    a = md5_hh(a, b, c, d, x[i+13], 4 ,  681279174);
    d = md5_hh(d, a, b, c, x[i+ 0], 11, -358537222);
    c = md5_hh(c, d, a, b, x[i+ 3], 16, -722521979);
    b = md5_hh(b, c, d, a, x[i+ 6], 23,  76029189);
    a = md5_hh(a, b, c, d, x[i+ 9], 4 , -640364487);
    d = md5_hh(d, a, b, c, x[i+12], 11, -421815835);
    c = md5_hh(c, d, a, b, x[i+15], 16,  530742520);
    b = md5_hh(b, c, d, a, x[i+ 2], 23, -995338651);

    a = md5_ii(a, b, c, d, x[i+ 0], 6 , -198630844);
    d = md5_ii(d, a, b, c, x[i+ 7], 10,  1126891415);
    c = md5_ii(c, d, a, b, x[i+14], 15, -1416354905);
    b = md5_ii(b, c, d, a, x[i+ 5], 21, -57434055);
    a = md5_ii(a, b, c, d, x[i+12], 6 ,  1700485571);
    d = md5_ii(d, a, b, c, x[i+ 3], 10, -1894986606);
    c = md5_ii(c, d, a, b, x[i+10], 15, -1051523);
    b = md5_ii(b, c, d, a, x[i+ 1], 21, -2054922799);
    a = md5_ii(a, b, c, d, x[i+ 8], 6 ,  1873313359);
    d = md5_ii(d, a, b, c, x[i+15], 10, -30611744);
    c = md5_ii(c, d, a, b, x[i+ 6], 15, -1560198380);
    b = md5_ii(b, c, d, a, x[i+13], 21,  1309151649);
    a = md5_ii(a, b, c, d, x[i+ 4], 6 , -145523070);
    d = md5_ii(d, a, b, c, x[i+11], 10, -1120210379);
    c = md5_ii(c, d, a, b, x[i+ 2], 15,  718787259);
    b = md5_ii(b, c, d, a, x[i+ 9], 21, -343485551);

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
  }
  return Array(a, b, c, d);

}


function md5_cmn(q, a, b, x, s, t)
{
  return safe_add(bit_rol(safe_add(safe_add(a, q), safe_add(x, t)), s),b);
}
function md5_ff(a, b, c, d, x, s, t)
{
  return md5_cmn((b & c) | ((~b) & d), a, b, x, s, t);
}
function md5_gg(a, b, c, d, x, s, t)
{
  return md5_cmn((b & d) | (c & (~d)), a, b, x, s, t);
}
function md5_hh(a, b, c, d, x, s, t)
{
  return md5_cmn(b ^ c ^ d, a, b, x, s, t);
}
function md5_ii(a, b, c, d, x, s, t)
{
  return md5_cmn(c ^ (b | (~d)), a, b, x, s, t);
}


function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}


function bit_rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function md5(buf) {
  return helpers.hash(buf, core_md5, 16);
};

},{"./helpers":57}],60:[function(require,module,exports){
(function() {
  var _global = this;

  var mathRNG, whatwgRNG;

  mathRNG = function(size) {
    var bytes = new Array(size);
    var r;

    for (var i = 0, r; i < size; i++) {
      if ((i & 0x03) == 0) r = Math.random() * 0x100000000;
      bytes[i] = r >>> ((i & 0x03) << 3) & 0xff;
    }

    return bytes;
  }

  if (_global.crypto && crypto.getRandomValues) {
    whatwgRNG = function(size) {
      var bytes = new Uint8Array(size);
      crypto.getRandomValues(bytes);
      return bytes;
    }
  }

  module.exports = whatwgRNG || mathRNG;

}())

},{}],61:[function(require,module,exports){


var helpers = require('./helpers');


function core_sha1(x, len)
{

  x[len >> 5] |= 0x80 << (24 - len % 32);
  x[((len + 64 >> 9) << 4) + 15] = len;

  var w = Array(80);
  var a =  1732584193;
  var b = -271733879;
  var c = -1732584194;
  var d =  271733878;
  var e = -1009589776;

  for(var i = 0; i < x.length; i += 16)
  {
    var olda = a;
    var oldb = b;
    var oldc = c;
    var oldd = d;
    var olde = e;

    for(var j = 0; j < 80; j++)
    {
      if(j < 16) w[j] = x[i + j];
      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
      e = d;
      d = c;
      c = rol(b, 30);
      b = a;
      a = t;
    }

    a = safe_add(a, olda);
    b = safe_add(b, oldb);
    c = safe_add(c, oldc);
    d = safe_add(d, oldd);
    e = safe_add(e, olde);
  }
  return Array(a, b, c, d, e);

}


function sha1_ft(t, b, c, d)
{
  if(t < 20) return (b & c) | ((~b) & d);
  if(t < 40) return b ^ c ^ d;
  if(t < 60) return (b & c) | (b & d) | (c & d);
  return b ^ c ^ d;
}


function sha1_kt(t)
{
  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
         (t < 60) ? -1894007588 : -899497514;
}


function safe_add(x, y)
{
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
}


function rol(num, cnt)
{
  return (num << cnt) | (num >>> (32 - cnt));
}

module.exports = function sha1(buf) {
  return helpers.hash(buf, core_sha1, 20, true);
};

},{"./helpers":57}],62:[function(require,module,exports){



var helpers = require('./helpers');

var safe_add = function(x, y) {
  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
  return (msw << 16) | (lsw & 0xFFFF);
};

var S = function(X, n) {
  return (X >>> n) | (X << (32 - n));
};

var R = function(X, n) {
  return (X >>> n);
};

var Ch = function(x, y, z) {
  return ((x & y) ^ ((~x) & z));
};

var Maj = function(x, y, z) {
  return ((x & y) ^ (x & z) ^ (y & z));
};

var Sigma0256 = function(x) {
  return (S(x, 2) ^ S(x, 13) ^ S(x, 22));
};

var Sigma1256 = function(x) {
  return (S(x, 6) ^ S(x, 11) ^ S(x, 25));
};

var Gamma0256 = function(x) {
  return (S(x, 7) ^ S(x, 18) ^ R(x, 3));
};

var Gamma1256 = function(x) {
  return (S(x, 17) ^ S(x, 19) ^ R(x, 10));
};

var core_sha256 = function(m, l) {
  var K = new Array(0x428A2F98,0x71374491,0xB5C0FBCF,0xE9B5DBA5,0x3956C25B,0x59F111F1,0x923F82A4,0xAB1C5ED5,0xD807AA98,0x12835B01,0x243185BE,0x550C7DC3,0x72BE5D74,0x80DEB1FE,0x9BDC06A7,0xC19BF174,0xE49B69C1,0xEFBE4786,0xFC19DC6,0x240CA1CC,0x2DE92C6F,0x4A7484AA,0x5CB0A9DC,0x76F988DA,0x983E5152,0xA831C66D,0xB00327C8,0xBF597FC7,0xC6E00BF3,0xD5A79147,0x6CA6351,0x14292967,0x27B70A85,0x2E1B2138,0x4D2C6DFC,0x53380D13,0x650A7354,0x766A0ABB,0x81C2C92E,0x92722C85,0xA2BFE8A1,0xA81A664B,0xC24B8B70,0xC76C51A3,0xD192E819,0xD6990624,0xF40E3585,0x106AA070,0x19A4C116,0x1E376C08,0x2748774C,0x34B0BCB5,0x391C0CB3,0x4ED8AA4A,0x5B9CCA4F,0x682E6FF3,0x748F82EE,0x78A5636F,0x84C87814,0x8CC70208,0x90BEFFFA,0xA4506CEB,0xBEF9A3F7,0xC67178F2);
  var HASH = new Array(0x6A09E667, 0xBB67AE85, 0x3C6EF372, 0xA54FF53A, 0x510E527F, 0x9B05688C, 0x1F83D9AB, 0x5BE0CD19);
    var W = new Array(64);
    var a, b, c, d, e, f, g, h, i, j;
    var T1, T2;

  m[l >> 5] |= 0x80 << (24 - l % 32);
  m[((l + 64 >> 9) << 4) + 15] = l;
  for (var i = 0; i < m.length; i += 16) {
    a = HASH[0]; b = HASH[1]; c = HASH[2]; d = HASH[3]; e = HASH[4]; f = HASH[5]; g = HASH[6]; h = HASH[7];
    for (var j = 0; j < 64; j++) {
      if (j < 16) {
        W[j] = m[j + i];
      } else {
        W[j] = safe_add(safe_add(safe_add(Gamma1256(W[j - 2]), W[j - 7]), Gamma0256(W[j - 15])), W[j - 16]);
      }
      T1 = safe_add(safe_add(safe_add(safe_add(h, Sigma1256(e)), Ch(e, f, g)), K[j]), W[j]);
      T2 = safe_add(Sigma0256(a), Maj(a, b, c));
      h = g; g = f; f = e; e = safe_add(d, T1); d = c; c = b; b = a; a = safe_add(T1, T2);
    }
    HASH[0] = safe_add(a, HASH[0]); HASH[1] = safe_add(b, HASH[1]); HASH[2] = safe_add(c, HASH[2]); HASH[3] = safe_add(d, HASH[3]);
    HASH[4] = safe_add(e, HASH[4]); HASH[5] = safe_add(f, HASH[5]); HASH[6] = safe_add(g, HASH[6]); HASH[7] = safe_add(h, HASH[7]);
  }
  return HASH;
};

module.exports = function sha256(buf) {
  return helpers.hash(buf, core_sha256, 32, true);
};

},{"./helpers":57}],63:[function(require,module,exports){

function EventEmitter() {
  this._events = this._events || {};
  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

EventEmitter.defaultMaxListeners = 10;

EventEmitter.prototype.setMaxListeners = function(n) {
  if (!isNumber(n) || n < 0 || isNaN(n))
    throw TypeError('n must be a positive number');
  this._maxListeners = n;
  return this;
};

EventEmitter.prototype.emit = function(type) {
  var er, handler, len, args, i, listeners;

  if (!this._events)
    this._events = {};

  if (type === 'error') {
    if (!this._events.error ||
        (isObject(this._events.error) && !this._events.error.length)) {
      er = arguments[1];
      if (er instanceof Error) {
        throw er; // Unhandled 'error' event
      }
      throw TypeError('Uncaught, unspecified "error" event.');
    }
  }

  handler = this._events[type];

  if (isUndefined(handler))
    return false;

  if (isFunction(handler)) {
    switch (arguments.length) {
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      default:
        len = arguments.length;
        args = new Array(len - 1);
        for (i = 1; i < len; i++)
          args[i - 1] = arguments[i];
        handler.apply(this, args);
    }
  } else if (isObject(handler)) {
    len = arguments.length;
    args = new Array(len - 1);
    for (i = 1; i < len; i++)
      args[i - 1] = arguments[i];

    listeners = handler.slice();
    len = listeners.length;
    for (i = 0; i < len; i++)
      listeners[i].apply(this, args);
  }

  return true;
};

EventEmitter.prototype.addListener = function(type, listener) {
  var m;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events)
    this._events = {};

  if (this._events.newListener)
    this.emit('newListener', type,
              isFunction(listener.listener) ?
              listener.listener : listener);

  if (!this._events[type])
    this._events[type] = listener;
  else if (isObject(this._events[type]))
    this._events[type].push(listener);
  else
    this._events[type] = [this._events[type], listener];

  if (isObject(this._events[type]) && !this._events[type].warned) {
    var m;
    if (!isUndefined(this._maxListeners)) {
      m = this._maxListeners;
    } else {
      m = EventEmitter.defaultMaxListeners;
    }

    if (m && m > 0 && this._events[type].length > m) {
      this._events[type].warned = true;
      console.error('(node) warning: possible EventEmitter memory ' +
                    'leak detected. %d listeners added. ' +
                    'Use emitter.setMaxListeners() to increase limit.',
                    this._events[type].length);
      if (typeof console.trace === 'function') {
        console.trace();
      }
    }
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  var fired = false;

  function g() {
    this.removeListener(type, g);

    if (!fired) {
      fired = true;
      listener.apply(this, arguments);
    }
  }

  g.listener = listener;
  this.on(type, g);

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  var list, position, length, i;

  if (!isFunction(listener))
    throw TypeError('listener must be a function');

  if (!this._events || !this._events[type])
    return this;

  list = this._events[type];
  length = list.length;
  position = -1;

  if (list === listener ||
      (isFunction(list.listener) && list.listener === listener)) {
    delete this._events[type];
    if (this._events.removeListener)
      this.emit('removeListener', type, listener);

  } else if (isObject(list)) {
    for (i = length; i-- > 0;) {
      if (list[i] === listener ||
          (list[i].listener && list[i].listener === listener)) {
        position = i;
        break;
      }
    }

    if (position < 0)
      return this;

    if (list.length === 1) {
      list.length = 0;
      delete this._events[type];
    } else {
      list.splice(position, 1);
    }

    if (this._events.removeListener)
      this.emit('removeListener', type, listener);
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  var key, listeners;

  if (!this._events)
    return this;

  if (!this._events.removeListener) {
    if (arguments.length === 0)
      this._events = {};
    else if (this._events[type])
      delete this._events[type];
    return this;
  }

  if (arguments.length === 0) {
    for (key in this._events) {
      if (key === 'removeListener') continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners('removeListener');
    this._events = {};
    return this;
  }

  listeners = this._events[type];

  if (isFunction(listeners)) {
    this.removeListener(type, listeners);
  } else {
    while (listeners.length)
      this.removeListener(type, listeners[listeners.length - 1]);
  }
  delete this._events[type];

  return this;
};

EventEmitter.prototype.listeners = function(type) {
  var ret;
  if (!this._events || !this._events[type])
    ret = [];
  else if (isFunction(this._events[type]))
    ret = [this._events[type]];
  else
    ret = this._events[type].slice();
  return ret;
};

EventEmitter.listenerCount = function(emitter, type) {
  var ret;
  if (!emitter._events || !emitter._events[type])
    ret = 0;
  else if (isFunction(emitter._events[type]))
    ret = 1;
  else
    ret = emitter._events[type].length;
  return ret;
};

function isFunction(arg) {
  return typeof arg === 'function';
}

function isNumber(arg) {
  return typeof arg === 'number';
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isUndefined(arg) {
  return arg === void 0;
}

},{}],64:[function(require,module,exports){
if (typeof Object.create === 'function') {
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],65:[function(require,module,exports){

var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
    && window.setImmediate;
    var canPost = typeof window !== 'undefined'
    && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            var source = ev.source;
            if ((source === window || source === null) && ev.data === 'process-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('process-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
}

process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};

},{}],66:[function(require,module,exports){
(function (global){

;(function(root) {


	var freeExports = typeof exports == 'object' && exports;
	var freeModule = typeof module == 'object' && module &&
		module.exports == freeExports && module;
	var freeGlobal = typeof global == 'object' && global;
	if (freeGlobal.global === freeGlobal || freeGlobal.window === freeGlobal) {
		root = freeGlobal;
	}


	var punycode,


	maxInt = 2147483647, // aka. 0x7FFFFFFF or 2^31-1


	base = 36,
	tMin = 1,
	tMax = 26,
	skew = 38,
	damp = 700,
	initialBias = 72,
	initialN = 128, // 0x80
	delimiter = '-', // '\x2D'


	regexPunycode = /^xn--/,
	regexNonASCII = /[^ -~]/, // unprintable ASCII chars + non-ASCII chars
	regexSeparators = /\x2E|\u3002|\uFF0E|\uFF61/g, // RFC 3490 separators


	errors = {
		'overflow': 'Overflow: input needs wider integers to process',
		'not-basic': 'Illegal input >= 0x80 (not a basic code point)',
		'invalid-input': 'Invalid input'
	},


	baseMinusTMin = base - tMin,
	floor = Math.floor,
	stringFromCharCode = String.fromCharCode,


	key;




	function error(type) {
		throw RangeError(errors[type]);
	}


	function map(array, fn) {
		var length = array.length;
		while (length--) {
			array[length] = fn(array[length]);
		}
		return array;
	}


	function mapDomain(string, fn) {
		return map(string.split(regexSeparators), fn).join('.');
	}


	function ucs2decode(string) {
		var output = [],
		    counter = 0,
		    length = string.length,
		    value,
		    extra;
		while (counter < length) {
			value = string.charCodeAt(counter++);
			if (value >= 0xD800 && value <= 0xDBFF && counter < length) {
				extra = string.charCodeAt(counter++);
				if ((extra & 0xFC00) == 0xDC00) { // low surrogate
					output.push(((value & 0x3FF) << 10) + (extra & 0x3FF) + 0x10000);
				} else {
					output.push(value);
					counter--;
				}
			} else {
				output.push(value);
			}
		}
		return output;
	}


	function ucs2encode(array) {
		return map(array, function(value) {
			var output = '';
			if (value > 0xFFFF) {
				value -= 0x10000;
				output += stringFromCharCode(value >>> 10 & 0x3FF | 0xD800);
				value = 0xDC00 | value & 0x3FF;
			}
			output += stringFromCharCode(value);
			return output;
		}).join('');
	}


	function basicToDigit(codePoint) {
		if (codePoint - 48 < 10) {
			return codePoint - 22;
		}
		if (codePoint - 65 < 26) {
			return codePoint - 65;
		}
		if (codePoint - 97 < 26) {
			return codePoint - 97;
		}
		return base;
	}


	function digitToBasic(digit, flag) {
		return digit + 22 + 75 * (digit < 26) - ((flag != 0) << 5);
	}


	function adapt(delta, numPoints, firstTime) {
		var k = 0;
		delta = firstTime ? floor(delta / damp) : delta >> 1;
		delta += floor(delta / numPoints);
		for (/* no initialization */; delta > baseMinusTMin * tMax >> 1; k += base) {
			delta = floor(delta / baseMinusTMin);
		}
		return floor(k + (baseMinusTMin + 1) * delta / (delta + skew));
	}


	function decode(input) {
		var output = [],
		    inputLength = input.length,
		    out,
		    i = 0,
		    n = initialN,
		    bias = initialBias,
		    basic,
		    j,
		    index,
		    oldi,
		    w,
		    k,
		    digit,
		    t,

		    baseMinusT;


		basic = input.lastIndexOf(delimiter);
		if (basic < 0) {
			basic = 0;
		}

		for (j = 0; j < basic; ++j) {
			if (input.charCodeAt(j) >= 0x80) {
				error('not-basic');
			}
			output.push(input.charCodeAt(j));
		}


		for (index = basic > 0 ? basic + 1 : 0; index < inputLength; /* no final expression */) {

			for (oldi = i, w = 1, k = base; /* no condition */; k += base) {

				if (index >= inputLength) {
					error('invalid-input');
				}

				digit = basicToDigit(input.charCodeAt(index++));

				if (digit >= base || digit > floor((maxInt - i) / w)) {
					error('overflow');
				}

				i += digit * w;
				t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);

				if (digit < t) {
					break;
				}

				baseMinusT = base - t;
				if (w > floor(maxInt / baseMinusT)) {
					error('overflow');
				}

				w *= baseMinusT;

			}

			out = output.length + 1;
			bias = adapt(i - oldi, out, oldi == 0);

			if (floor(i / out) > maxInt - n) {
				error('overflow');
			}

			n += floor(i / out);
			i %= out;

			output.splice(i++, 0, n);

		}

		return ucs2encode(output);
	}


	function encode(input) {
		var n,
		    delta,
		    handledCPCount,
		    basicLength,
		    bias,
		    j,
		    m,
		    q,
		    k,
		    t,
		    currentValue,
		    output = [],

		    inputLength,

		    handledCPCountPlusOne,
		    baseMinusT,
		    qMinusT;

		input = ucs2decode(input);

		inputLength = input.length;

		n = initialN;
		delta = 0;
		bias = initialBias;

		for (j = 0; j < inputLength; ++j) {
			currentValue = input[j];
			if (currentValue < 0x80) {
				output.push(stringFromCharCode(currentValue));
			}
		}

		handledCPCount = basicLength = output.length;


		if (basicLength) {
			output.push(delimiter);
		}

		while (handledCPCount < inputLength) {

			for (m = maxInt, j = 0; j < inputLength; ++j) {
				currentValue = input[j];
				if (currentValue >= n && currentValue < m) {
					m = currentValue;
				}
			}

			handledCPCountPlusOne = handledCPCount + 1;
			if (m - n > floor((maxInt - delta) / handledCPCountPlusOne)) {
				error('overflow');
			}

			delta += (m - n) * handledCPCountPlusOne;
			n = m;

			for (j = 0; j < inputLength; ++j) {
				currentValue = input[j];

				if (currentValue < n && ++delta > maxInt) {
					error('overflow');
				}

				if (currentValue == n) {
					for (q = delta, k = base; /* no condition */; k += base) {
						t = k <= bias ? tMin : (k >= bias + tMax ? tMax : k - bias);
						if (q < t) {
							break;
						}
						qMinusT = q - t;
						baseMinusT = base - t;
						output.push(
							stringFromCharCode(digitToBasic(t + qMinusT % baseMinusT, 0))
						);
						q = floor(qMinusT / baseMinusT);
					}

					output.push(stringFromCharCode(digitToBasic(q, 0)));
					bias = adapt(delta, handledCPCountPlusOne, handledCPCount == basicLength);
					delta = 0;
					++handledCPCount;
				}
			}

			++delta;
			++n;

		}
		return output.join('');
	}


	function toUnicode(domain) {
		return mapDomain(domain, function(string) {
			return regexPunycode.test(string)
				? decode(string.slice(4).toLowerCase())
				: string;
		});
	}


	function toASCII(domain) {
		return mapDomain(domain, function(string) {
			return regexNonASCII.test(string)
				? 'xn--' + encode(string)
				: string;
		});
	}




	punycode = {

		'version': '1.2.4',

		'ucs2': {
			'decode': ucs2decode,
			'encode': ucs2encode
		},
		'decode': decode,
		'encode': encode,
		'toASCII': toASCII,
		'toUnicode': toUnicode
	};


	if (
		typeof define == 'function' &&
		typeof define.amd == 'object' &&
		define.amd
	) {
		define('punycode', function() {
			return punycode;
		});
	} else if (freeExports && !freeExports.nodeType) {
		if (freeModule) { // in Node.js or RingoJS v0.8.0+
			freeModule.exports = punycode;
		} else { // in Narwhal or RingoJS v0.7.0-
			for (key in punycode) {
				punycode.hasOwnProperty(key) && (freeExports[key] = punycode[key]);
			}
		}
	} else { // in Rhino or a web browser
		root.punycode = punycode;
	}

}(this));

}).call(this,typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],67:[function(require,module,exports){

'use strict';

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

module.exports = function(qs, sep, eq, options) {
  sep = sep || '&';
  eq = eq || '=';
  var obj = {};

  if (typeof qs !== 'string' || qs.length === 0) {
    return obj;
  }

  var regexp = /\+/g;
  qs = qs.split(sep);

  var maxKeys = 1000;
  if (options && typeof options.maxKeys === 'number') {
    maxKeys = options.maxKeys;
  }

  var len = qs.length;
  if (maxKeys > 0 && len > maxKeys) {
    len = maxKeys;
  }

  for (var i = 0; i < len; ++i) {
    var x = qs[i].replace(regexp, '%20'),
        idx = x.indexOf(eq),
        kstr, vstr, k, v;

    if (idx >= 0) {
      kstr = x.substr(0, idx);
      vstr = x.substr(idx + 1);
    } else {
      kstr = x;
      vstr = '';
    }

    k = decodeURIComponent(kstr);
    v = decodeURIComponent(vstr);

    if (!hasOwnProperty(obj, k)) {
      obj[k] = v;
    } else if (isArray(obj[k])) {
      obj[k].push(v);
    } else {
      obj[k] = [obj[k], v];
    }
  }

  return obj;
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

},{}],68:[function(require,module,exports){

'use strict';

var stringifyPrimitive = function(v) {
  switch (typeof v) {
    case 'string':
      return v;

    case 'boolean':
      return v ? 'true' : 'false';

    case 'number':
      return isFinite(v) ? v : '';

    default:
      return '';
  }
};

module.exports = function(obj, sep, eq, name) {
  sep = sep || '&';
  eq = eq || '=';
  if (obj === null) {
    obj = undefined;
  }

  if (typeof obj === 'object') {
    return map(objectKeys(obj), function(k) {
      var ks = encodeURIComponent(stringifyPrimitive(k)) + eq;
      if (isArray(obj[k])) {
        return obj[k].map(function(v) {
          return ks + encodeURIComponent(stringifyPrimitive(v));
        }).join(sep);
      } else {
        return ks + encodeURIComponent(stringifyPrimitive(obj[k]));
      }
    }).join(sep);

  }

  if (!name) return '';
  return encodeURIComponent(stringifyPrimitive(name)) + eq +
         encodeURIComponent(stringifyPrimitive(obj));
};

var isArray = Array.isArray || function (xs) {
  return Object.prototype.toString.call(xs) === '[object Array]';
};

function map (xs, f) {
  if (xs.map) return xs.map(f);
  var res = [];
  for (var i = 0; i < xs.length; i++) {
    res.push(f(xs[i], i));
  }
  return res;
}

var objectKeys = Object.keys || function (obj) {
  var res = [];
  for (var key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) res.push(key);
  }
  return res;
};

},{}],69:[function(require,module,exports){
'use strict';

exports.decode = exports.parse = require('./decode');
exports.encode = exports.stringify = require('./encode');

},{"./decode":67,"./encode":68}],70:[function(require,module,exports){

var punycode = require('punycode');

exports.parse = urlParse;
exports.resolve = urlResolve;
exports.resolveObject = urlResolveObject;
exports.format = urlFormat;

exports.Url = Url;

function Url() {
  this.protocol = null;
  this.slashes = null;
  this.auth = null;
  this.host = null;
  this.port = null;
  this.hostname = null;
  this.hash = null;
  this.search = null;
  this.query = null;
  this.pathname = null;
  this.path = null;
  this.href = null;
}


var protocolPattern = /^([a-z0-9.+-]+:)/i,
    portPattern = /:[0-9]*$/,

    delims = ['<', '>', '"', '`', ' ', '\r', '\n', '\t'],

    unwise = ['{', '}', '|', '\\', '^', '`'].concat(delims),

    autoEscape = ['\''].concat(unwise),
    nonHostChars = ['%', '/', '?', ';', '#'].concat(autoEscape),
    hostEndingChars = ['/', '?', '#'],
    hostnameMaxLen = 255,
    hostnamePartPattern = /^[a-z0-9A-Z_-]{0,63}$/,
    hostnamePartStart = /^([a-z0-9A-Z_-]{0,63})(.*)$/,
    unsafeProtocol = {
      'javascript': true,
      'javascript:': true
    },
    hostlessProtocol = {
      'javascript': true,
      'javascript:': true
    },
    slashedProtocol = {
      'http': true,
      'https': true,
      'ftp': true,
      'gopher': true,
      'file': true,
      'http:': true,
      'https:': true,
      'ftp:': true,
      'gopher:': true,
      'file:': true
    },
    querystring = require('querystring');

function urlParse(url, parseQueryString, slashesDenoteHost) {
  if (url && isObject(url) && url instanceof Url) return url;

  var u = new Url;
  u.parse(url, parseQueryString, slashesDenoteHost);
  return u;
}

Url.prototype.parse = function(url, parseQueryString, slashesDenoteHost) {
  if (!isString(url)) {
    throw new TypeError("Parameter 'url' must be a string, not " + typeof url);
  }

  var rest = url;

  rest = rest.trim();

  var proto = protocolPattern.exec(rest);
  if (proto) {
    proto = proto[0];
    var lowerProto = proto.toLowerCase();
    this.protocol = lowerProto;
    rest = rest.substr(proto.length);
  }

  if (slashesDenoteHost || proto || rest.match(/^\/\/[^@\/]+@[^@\/]+/)) {
    var slashes = rest.substr(0, 2) === '//';
    if (slashes && !(proto && hostlessProtocol[proto])) {
      rest = rest.substr(2);
      this.slashes = true;
    }
  }

  if (!hostlessProtocol[proto] &&
      (slashes || (proto && !slashedProtocol[proto]))) {



    var hostEnd = -1;
    for (var i = 0; i < hostEndingChars.length; i++) {
      var hec = rest.indexOf(hostEndingChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }

    var auth, atSign;
    if (hostEnd === -1) {
      atSign = rest.lastIndexOf('@');
    } else {
      atSign = rest.lastIndexOf('@', hostEnd);
    }

    if (atSign !== -1) {
      auth = rest.slice(0, atSign);
      rest = rest.slice(atSign + 1);
      this.auth = decodeURIComponent(auth);
    }

    hostEnd = -1;
    for (var i = 0; i < nonHostChars.length; i++) {
      var hec = rest.indexOf(nonHostChars[i]);
      if (hec !== -1 && (hostEnd === -1 || hec < hostEnd))
        hostEnd = hec;
    }
    if (hostEnd === -1)
      hostEnd = rest.length;

    this.host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);

    this.parseHost();

    this.hostname = this.hostname || '';

    var ipv6Hostname = this.hostname[0] === '[' &&
        this.hostname[this.hostname.length - 1] === ']';

    if (!ipv6Hostname) {
      var hostparts = this.hostname.split(/\./);
      for (var i = 0, l = hostparts.length; i < l; i++) {
        var part = hostparts[i];
        if (!part) continue;
        if (!part.match(hostnamePartPattern)) {
          var newpart = '';
          for (var j = 0, k = part.length; j < k; j++) {
            if (part.charCodeAt(j) > 127) {
              newpart += 'x';
            } else {
              newpart += part[j];
            }
          }
          if (!newpart.match(hostnamePartPattern)) {
            var validParts = hostparts.slice(0, i);
            var notHost = hostparts.slice(i + 1);
            var bit = part.match(hostnamePartStart);
            if (bit) {
              validParts.push(bit[1]);
              notHost.unshift(bit[2]);
            }
            if (notHost.length) {
              rest = '/' + notHost.join('.') + rest;
            }
            this.hostname = validParts.join('.');
            break;
          }
        }
      }
    }

    if (this.hostname.length > hostnameMaxLen) {
      this.hostname = '';
    } else {
      this.hostname = this.hostname.toLowerCase();
    }

    if (!ipv6Hostname) {
      var domainArray = this.hostname.split('.');
      var newOut = [];
      for (var i = 0; i < domainArray.length; ++i) {
        var s = domainArray[i];
        newOut.push(s.match(/[^A-Za-z0-9_-]/) ?
            'xn--' + punycode.encode(s) : s);
      }
      this.hostname = newOut.join('.');
    }

    var p = this.port ? ':' + this.port : '';
    var h = this.hostname || '';
    this.host = h + p;
    this.href += this.host;

    if (ipv6Hostname) {
      this.hostname = this.hostname.substr(1, this.hostname.length - 2);
      if (rest[0] !== '/') {
        rest = '/' + rest;
      }
    }
  }

  if (!unsafeProtocol[lowerProto]) {

    for (var i = 0, l = autoEscape.length; i < l; i++) {
      var ae = autoEscape[i];
      var esc = encodeURIComponent(ae);
      if (esc === ae) {
        esc = escape(ae);
      }
      rest = rest.split(ae).join(esc);
    }
  }


  var hash = rest.indexOf('#');
  if (hash !== -1) {
    this.hash = rest.substr(hash);
    rest = rest.slice(0, hash);
  }
  var qm = rest.indexOf('?');
  if (qm !== -1) {
    this.search = rest.substr(qm);
    this.query = rest.substr(qm + 1);
    if (parseQueryString) {
      this.query = querystring.parse(this.query);
    }
    rest = rest.slice(0, qm);
  } else if (parseQueryString) {
    this.search = '';
    this.query = {};
  }
  if (rest) this.pathname = rest;
  if (slashedProtocol[lowerProto] &&
      this.hostname && !this.pathname) {
    this.pathname = '/';
  }

  if (this.pathname || this.search) {
    var p = this.pathname || '';
    var s = this.search || '';
    this.path = p + s;
  }

  this.href = this.format();
  return this;
};

function urlFormat(obj) {
  if (isString(obj)) obj = urlParse(obj);
  if (!(obj instanceof Url)) return Url.prototype.format.call(obj);
  return obj.format();
}

Url.prototype.format = function() {
  var auth = this.auth || '';
  if (auth) {
    auth = encodeURIComponent(auth);
    auth = auth.replace(/%3A/i, ':');
    auth += '@';
  }

  var protocol = this.protocol || '',
      pathname = this.pathname || '',
      hash = this.hash || '',
      host = false,
      query = '';

  if (this.host) {
    host = auth + this.host;
  } else if (this.hostname) {
    host = auth + (this.hostname.indexOf(':') === -1 ?
        this.hostname :
        '[' + this.hostname + ']');
    if (this.port) {
      host += ':' + this.port;
    }
  }

  if (this.query &&
      isObject(this.query) &&
      Object.keys(this.query).length) {
    query = querystring.stringify(this.query);
  }

  var search = this.search || (query && ('?' + query)) || '';

  if (protocol && protocol.substr(-1) !== ':') protocol += ':';

  if (this.slashes ||
      (!protocol || slashedProtocol[protocol]) && host !== false) {
    host = '//' + (host || '');
    if (pathname && pathname.charAt(0) !== '/') pathname = '/' + pathname;
  } else if (!host) {
    host = '';
  }

  if (hash && hash.charAt(0) !== '#') hash = '#' + hash;
  if (search && search.charAt(0) !== '?') search = '?' + search;

  pathname = pathname.replace(/[?#]/g, function(match) {
    return encodeURIComponent(match);
  });
  search = search.replace('#', '%23');

  return protocol + host + pathname + search + hash;
};

function urlResolve(source, relative) {
  return urlParse(source, false, true).resolve(relative);
}

Url.prototype.resolve = function(relative) {
  return this.resolveObject(urlParse(relative, false, true)).format();
};

function urlResolveObject(source, relative) {
  if (!source) return relative;
  return urlParse(source, false, true).resolveObject(relative);
}

Url.prototype.resolveObject = function(relative) {
  if (isString(relative)) {
    var rel = new Url();
    rel.parse(relative, false, true);
    relative = rel;
  }

  var result = new Url();
  Object.keys(this).forEach(function(k) {
    result[k] = this[k];
  }, this);

  result.hash = relative.hash;

  if (relative.href === '') {
    result.href = result.format();
    return result;
  }

  if (relative.slashes && !relative.protocol) {
    Object.keys(relative).forEach(function(k) {
      if (k !== 'protocol')
        result[k] = relative[k];
    });

    if (slashedProtocol[result.protocol] &&
        result.hostname && !result.pathname) {
      result.path = result.pathname = '/';
    }

    result.href = result.format();
    return result;
  }

  if (relative.protocol && relative.protocol !== result.protocol) {
    if (!slashedProtocol[relative.protocol]) {
      Object.keys(relative).forEach(function(k) {
        result[k] = relative[k];
      });
      result.href = result.format();
      return result;
    }

    result.protocol = relative.protocol;
    if (!relative.host && !hostlessProtocol[relative.protocol]) {
      var relPath = (relative.pathname || '').split('/');
      while (relPath.length && !(relative.host = relPath.shift()));
      if (!relative.host) relative.host = '';
      if (!relative.hostname) relative.hostname = '';
      if (relPath[0] !== '') relPath.unshift('');
      if (relPath.length < 2) relPath.unshift('');
      result.pathname = relPath.join('/');
    } else {
      result.pathname = relative.pathname;
    }
    result.search = relative.search;
    result.query = relative.query;
    result.host = relative.host || '';
    result.auth = relative.auth;
    result.hostname = relative.hostname || relative.host;
    result.port = relative.port;
    if (result.pathname || result.search) {
      var p = result.pathname || '';
      var s = result.search || '';
      result.path = p + s;
    }
    result.slashes = result.slashes || relative.slashes;
    result.href = result.format();
    return result;
  }

  var isSourceAbs = (result.pathname && result.pathname.charAt(0) === '/'),
      isRelAbs = (
          relative.host ||
          relative.pathname && relative.pathname.charAt(0) === '/'
      ),
      mustEndAbs = (isRelAbs || isSourceAbs ||
                    (result.host && relative.pathname)),
      removeAllDots = mustEndAbs,
      srcPath = result.pathname && result.pathname.split('/') || [],
      relPath = relative.pathname && relative.pathname.split('/') || [],
      psychotic = result.protocol && !slashedProtocol[result.protocol];

  if (psychotic) {
    result.hostname = '';
    result.port = null;
    if (result.host) {
      if (srcPath[0] === '') srcPath[0] = result.host;
      else srcPath.unshift(result.host);
    }
    result.host = '';
    if (relative.protocol) {
      relative.hostname = null;
      relative.port = null;
      if (relative.host) {
        if (relPath[0] === '') relPath[0] = relative.host;
        else relPath.unshift(relative.host);
      }
      relative.host = null;
    }
    mustEndAbs = mustEndAbs && (relPath[0] === '' || srcPath[0] === '');
  }

  if (isRelAbs) {
    result.host = (relative.host || relative.host === '') ?
                  relative.host : result.host;
    result.hostname = (relative.hostname || relative.hostname === '') ?
                      relative.hostname : result.hostname;
    result.search = relative.search;
    result.query = relative.query;
    srcPath = relPath;
  } else if (relPath.length) {
    if (!srcPath) srcPath = [];
    srcPath.pop();
    srcPath = srcPath.concat(relPath);
    result.search = relative.search;
    result.query = relative.query;
  } else if (!isNullOrUndefined(relative.search)) {
    if (psychotic) {
      result.hostname = result.host = srcPath.shift();
      var authInHost = result.host && result.host.indexOf('@') > 0 ?
                       result.host.split('@') : false;
      if (authInHost) {
        result.auth = authInHost.shift();
        result.host = result.hostname = authInHost.shift();
      }
    }
    result.search = relative.search;
    result.query = relative.query;
    if (!isNull(result.pathname) || !isNull(result.search)) {
      result.path = (result.pathname ? result.pathname : '') +
                    (result.search ? result.search : '');
    }
    result.href = result.format();
    return result;
  }

  if (!srcPath.length) {
    result.pathname = null;
    if (result.search) {
      result.path = '/' + result.search;
    } else {
      result.path = null;
    }
    result.href = result.format();
    return result;
  }

  var last = srcPath.slice(-1)[0];
  var hasTrailingSlash = (
      (result.host || relative.host) && (last === '.' || last === '..') ||
      last === '');

  var up = 0;
  for (var i = srcPath.length; i >= 0; i--) {
    last = srcPath[i];
    if (last == '.') {
      srcPath.splice(i, 1);
    } else if (last === '..') {
      srcPath.splice(i, 1);
      up++;
    } else if (up) {
      srcPath.splice(i, 1);
      up--;
    }
  }

  if (!mustEndAbs && !removeAllDots) {
    for (; up--; up) {
      srcPath.unshift('..');
    }
  }

  if (mustEndAbs && srcPath[0] !== '' &&
      (!srcPath[0] || srcPath[0].charAt(0) !== '/')) {
    srcPath.unshift('');
  }

  if (hasTrailingSlash && (srcPath.join('/').substr(-1) !== '/')) {
    srcPath.push('');
  }

  var isAbsolute = srcPath[0] === '' ||
      (srcPath[0] && srcPath[0].charAt(0) === '/');

  if (psychotic) {
    result.hostname = result.host = isAbsolute ? '' :
                                    srcPath.length ? srcPath.shift() : '';
    var authInHost = result.host && result.host.indexOf('@') > 0 ?
                     result.host.split('@') : false;
    if (authInHost) {
      result.auth = authInHost.shift();
      result.host = result.hostname = authInHost.shift();
    }
  }

  mustEndAbs = mustEndAbs || (result.host && srcPath.length);

  if (mustEndAbs && !isAbsolute) {
    srcPath.unshift('');
  }

  if (!srcPath.length) {
    result.pathname = null;
    result.path = null;
  } else {
    result.pathname = srcPath.join('/');
  }

  if (!isNull(result.pathname) || !isNull(result.search)) {
    result.path = (result.pathname ? result.pathname : '') +
                  (result.search ? result.search : '');
  }
  result.auth = relative.auth || result.auth;
  result.slashes = result.slashes || relative.slashes;
  result.href = result.format();
  return result;
};

Url.prototype.parseHost = function() {
  var host = this.host;
  var port = portPattern.exec(host);
  if (port) {
    port = port[0];
    if (port !== ':') {
      this.port = port.substr(1);
    }
    host = host.substr(0, host.length - port.length);
  }
  if (host) this.hostname = host;
};

function isString(arg) {
  return typeof arg === "string";
}

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}

function isNull(arg) {
  return arg === null;
}
function isNullOrUndefined(arg) {
  return  arg == null;
}

},{"punycode":66,"querystring":69}],71:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],72:[function(require,module,exports){
(function (process,global){

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


exports.deprecate = function(fn, msg) {
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};




function inspect(obj, opts) {
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    ctx.showHidden = opts;
  } else if (opts) {
    exports._extend(ctx, opts);
  }
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      value.inspect !== exports.inspect &&
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};



exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require("FWaASH"),typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":71,"FWaASH":65,"inherits":64}],73:[function(require,module,exports){
(function() {
  var XMLBuilder, XMLFragment;

  XMLFragment = require('./XMLFragment');

  XMLBuilder = (function() {

    function XMLBuilder(name, xmldec, doctype) {
      var att, child, _ref;
      this.children = [];
      this.rootObject = null;
      if (this.is(name, 'Object')) {
        _ref = [name, xmldec], xmldec = _ref[0], doctype = _ref[1];
        name = null;
      }
      if (name != null) {
        name = '' + name || '';
        if (xmldec == null) {
          xmldec = {
            'version': '1.0'
          };
        }
      }
      if ((xmldec != null) && !(xmldec.version != null)) {
        throw new Error("Version number is required");
      }
      if (xmldec != null) {
        xmldec.version = '' + xmldec.version || '';
        if (!xmldec.version.match(/1\.[0-9]+/)) {
          throw new Error("Invalid version number: " + xmldec.version);
        }
        att = {
          version: xmldec.version
        };
        if (xmldec.encoding != null) {
          xmldec.encoding = '' + xmldec.encoding || '';
          if (!xmldec.encoding.match(/[A-Za-z](?:[A-Za-z0-9._-]|-)*/)) {
            throw new Error("Invalid encoding: " + xmldec.encoding);
          }
          att.encoding = xmldec.encoding;
        }
        if (xmldec.standalone != null) {
          att.standalone = xmldec.standalone ? "yes" : "no";
        }
        child = new XMLFragment(this, '?xml', att);
        this.children.push(child);
      }
      if (doctype != null) {
        att = {};
        if (name != null) {
          att.name = name;
        }
        if (doctype.ext != null) {
          doctype.ext = '' + doctype.ext || '';
          att.ext = doctype.ext;
        }
        child = new XMLFragment(this, '!DOCTYPE', att);
        this.children.push(child);
      }
      if (name != null) {
        this.begin(name);
      }
    }

    XMLBuilder.prototype.begin = function(name, xmldec, doctype) {
      var doc, root;
      if (!(name != null)) {
        throw new Error("Root element needs a name");
      }
      if (this.rootObject) {
        this.children = [];
        this.rootObject = null;
      }
      if (xmldec != null) {
        doc = new XMLBuilder(name, xmldec, doctype);
        return doc.root();
      }
      name = '' + name || '';
      root = new XMLFragment(this, name, {});
      root.isRoot = true;
      root.documentObject = this;
      this.children.push(root);
      this.rootObject = root;
      return root;
    };

    XMLBuilder.prototype.root = function() {
      return this.rootObject;
    };

    XMLBuilder.prototype.end = function(options) {
      return toString(options);
    };

    XMLBuilder.prototype.toString = function(options) {
      var child, r, _i, _len, _ref;
      r = '';
      _ref = this.children;
      for (_i = 0, _len = _ref.length; _i < _len; _i++) {
        child = _ref[_i];
        r += child.toString(options);
      }
      return r;
    };

    XMLBuilder.prototype.is = function(obj, type) {
      var clas;
      clas = Object.prototype.toString.call(obj).slice(8, -1);
      return (obj != null) && clas === type;
    };

    return XMLBuilder;

  })();

  module.exports = XMLBuilder;

}).call(this);

},{"./XMLFragment":74}],74:[function(require,module,exports){
(function() {
  var XMLFragment,
    __hasProp = {}.hasOwnProperty;

  XMLFragment = (function() {

    function XMLFragment(parent, name, attributes, text) {
      this.isRoot = false;
      this.documentObject = null;
      this.parent = parent;
      this.name = name;
      this.attributes = attributes;
      this.value = text;
      this.children = [];
    }

    XMLFragment.prototype.element = function(name, attributes, text) {
      var child, key, val, _ref, _ref1;
      if (!(name != null)) {
        throw new Error("Missing element name");
      }
      name = '' + name || '';
      this.assertLegalChar(name);
      if (attributes == null) {
        attributes = {};
      }
      if (this.is(attributes, 'String') && this.is(text, 'Object')) {
        _ref = [text, attributes], attributes = _ref[0], text = _ref[1];
      } else if (this.is(attributes, 'String')) {
        _ref1 = [{}, attributes], attributes = _ref1[0], text = _ref1[1];
      }
      for (key in attributes) {
        if (!__hasProp.call(attributes, key)) continue;
        val = attributes[key];
        val = '' + val || '';
        attributes[key] = this.escape(val);
      }
      child = new XMLFragment(this, name, attributes);
      if (text != null) {
        text = '' + text || '';
        text = this.escape(text);
        this.assertLegalChar(text);
        child.raw(text);
      }
      this.children.push(child);
      return child;
    };

    XMLFragment.prototype.insertBefore = function(name, attributes, text) {
      var child, i, key, val, _ref, _ref1;
      if (this.isRoot) {
        throw new Error("Cannot insert elements at root level");
      }
      if (!(name != null)) {
        throw new Error("Missing element name");
      }
      name = '' + name || '';
      this.assertLegalChar(name);
      if (attributes == null) {
        attributes = {};
      }
      if (this.is(attributes, 'String') && this.is(text, 'Object')) {
        _ref = [text, attributes], attributes = _ref[0], text = _ref[1];
      } else if (this.is(attributes, 'String')) {
        _ref1 = [{}, attributes], attributes = _ref1[0], text = _ref1[1];
      }
      for (key in attributes) {
        if (!__hasProp.call(attributes, key)) continue;
        val = attributes[key];
        val = '' + val || '';
        attributes[key] = this.escape(val);
      }
      child = new XMLFragment(this.parent, name, attributes);
      if (text != null) {
        text = '' + text || '';
        text = this.escape(text);
        this.assertLegalChar(text);
        child.raw(text);
      }
      i = this.parent.children.indexOf(this);
      this.parent.children.splice(i, 0, child);
      return child;
    };

    XMLFragment.prototype.insertAfter = function(name, attributes, text) {
      var child, i, key, val, _ref, _ref1;
      if (this.isRoot) {
        throw new Error("Cannot insert elements at root level");
      }
      if (!(name != null)) {
        throw new Error("Missing element name");
      }
      name = '' + name || '';
      this.assertLegalChar(name);
      if (attributes == null) {
        attributes = {};
      }
      if (this.is(attributes, 'String') && this.is(text, 'Object')) {
        _ref = [text, attributes], attributes = _ref[0], text = _ref[1];
      } else if (this.is(attributes, 'String')) {
        _ref1 = [{}, attributes], attributes = _ref1[0], text = _ref1[1];
      }
      for (key in attributes) {
        if (!__hasProp.call(attributes, key)) continue;
        val = attributes[key];
        val = '' + val || '';
        attributes[key] = this.escape(val);
      }
      child = new XMLFragment(this.parent, name, attributes);
      if (text != null) {
        text = '' + text || '';
        text = this.escape(text);
        this.assertLegalChar(text);
        child.raw(text);
      }
      i = this.parent.children.indexOf(this);
      this.parent.children.splice(i + 1, 0, child);
      return child;
    };

    XMLFragment.prototype.remove = function() {
      var i, _ref;
      if (this.isRoot) {
        throw new Error("Cannot remove the root element");
      }
      i = this.parent.children.indexOf(this);
      [].splice.apply(this.parent.children, [i, i - i + 1].concat(_ref = [])), _ref;
      return this.parent;
    };

    XMLFragment.prototype.text = function(value) {
      var child;
      if (!(value != null)) {
        throw new Error("Missing element text");
      }
      value = '' + value || '';
      value = this.escape(value);
      this.assertLegalChar(value);
      child = new XMLFragment(this, '', {}, value);
      this.children.push(child);
      return this;
    };

    XMLFragment.prototype.cdata = function(value) {
      var child;
      if (!(value != null)) {
        throw new Error("Missing CDATA text");
      }
      value = '' + value || '';
      this.assertLegalChar(value);
      if (value.match(/]]>/)) {
        throw new Error("Invalid CDATA text: " + value);
      }
      child = new XMLFragment(this, '', {}, '<![CDATA[' + value + ']]>');
      this.children.push(child);
      return this;
    };

    XMLFragment.prototype.comment = function(value) {
      var child;
      if (!(value != null)) {
        throw new Error("Missing comment text");
      }
      value = '' + value || '';
      value = this.escape(value);
      this.assertLegalChar(value);
      if (value.match(/--/)) {
        throw new Error("Comment text cannot contain double-hypen: " + value);
      }
      child = new XMLFragment(this, '', {}, '<!-- ' + value + ' -->');
      this.children.push(child);
      return this;
    };

    XMLFragment.prototype.raw = function(value) {
      var child;
      if (!(value != null)) {
        throw new Error("Missing raw text");
      }
      value = '' + value || '';
      child = new XMLFragment(this, '', {}, value);
      this.children.push(child);
      return this;
    };

    XMLFragment.prototype.up = function() {
      if (this.isRoot) {
        throw new Error("This node has no parent. Use doc() if you need to get the document object.");
      }
      return this.parent;
    };

    XMLFragment.prototype.root = function() {
      var child;
      if (this.isRoot) {
        return this;
      }
      child = this.parent;
      while (!child.isRoot) {
        child = child.parent;
      }
      return child;
    };

    XMLFragment.prototype.document = function() {
      return this.root().documentObject;
    };

    XMLFragment.prototype.end = function(options) {
      return this.document().toString(options);
    };

    XMLFragment.prototype.prev = function() {
      var i;
      if (this.isRoot) {
        throw new Error("Root node has no siblings");
      }
      i = this.parent.children.indexOf(this);
      if (i < 1) {
        throw new Error("Already at the first node");
      }
      return this.parent.children[i - 1];
    };

    XMLFragment.prototype.next = function() {
      var i;
      if (this.isRoot) {
        throw new Error("Root node has no siblings");
      }
      i = this.parent.children.indexOf(this);
      if (i === -1 || i === this.parent.children.length - 1) {
        throw new Error("Already at the last node");
      }
      return this.parent.children[i + 1];
    };

    XMLFragment.prototype.clone = function(deep) {
      var clonedSelf;
      clonedSelf = new XMLFragment(this.parent, this.name, this.attributes, this.value);
      if (deep) {
        this.children.forEach(function(child) {
          var clonedChild;
          clonedChild = child.clone(deep);
          clonedChild.parent = clonedSelf;
          return clonedSelf.children.push(clonedChild);
        });
      }
      return clonedSelf;
    };

    XMLFragment.prototype.importXMLBuilder = function(xmlbuilder) {
      var clonedRoot;
      clonedRoot = xmlbuilder.root().clone(true);
      clonedRoot.parent = this;
      this.children.push(clonedRoot);
      clonedRoot.isRoot = false;
      return this;
    };

    XMLFragment.prototype.attribute = function(name, value) {
      var _ref;
      if (!(name != null)) {
        throw new Error("Missing attribute name");
      }
      if (!(value != null)) {
        throw new Error("Missing attribute value");
      }
      name = '' + name || '';
      value = '' + value || '';
      if ((_ref = this.attributes) == null) {
        this.attributes = {};
      }
      this.attributes[name] = this.escape(value);
      return this;
    };

    XMLFragment.prototype.removeAttribute = function(name) {
      if (!(name != null)) {
        throw new Error("Missing attribute name");
      }
      name = '' + name || '';
      delete this.attributes[name];
      return this;
    };

    XMLFragment.prototype.toString = function(options, level) {
      var attName, attValue, child, indent, newline, pretty, r, space, _i, _len, _ref, _ref1;
      pretty = (options != null) && options.pretty || false;
      indent = (options != null) && options.indent || '  ';
      newline = (options != null) && options.newline || '\n';
      level || (level = 0);
      space = new Array(level + 1).join(indent);
      r = '';
      if (pretty) {
        r += space;
      }
      if (!(this.value != null)) {
        r += '<' + this.name;
      } else {
        r += '' + this.value;
      }
      _ref = this.attributes;
      for (attName in _ref) {
        attValue = _ref[attName];
        if (this.name === '!DOCTYPE') {
          r += ' ' + attValue;
        } else {
          r += ' ' + attName + '="' + attValue + '"';
        }
      }
      if (this.children.length === 0) {
        if (!(this.value != null)) {
          r += this.name === '?xml' ? '?>' : this.name === '!DOCTYPE' ? '>' : '/>';
        }
        if (pretty) {
          r += newline;
        }
      } else if (pretty && this.children.length === 1 && this.children[0].value) {
        r += '>';
        r += this.children[0].value;
        r += '</' + this.name + '>';
        r += newline;
      } else {
        r += '>';
        if (pretty) {
          r += newline;
        }
        _ref1 = this.children;
        for (_i = 0, _len = _ref1.length; _i < _len; _i++) {
          child = _ref1[_i];
          r += child.toString(options, level + 1);
        }
        if (pretty) {
          r += space;
        }
        r += '</' + this.name + '>';
        if (pretty) {
          r += newline;
        }
      }
      return r;
    };

    XMLFragment.prototype.escape = function(str) {
      return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/'/g, '&apos;').replace(/"/g, '&quot;');
    };

    XMLFragment.prototype.assertLegalChar = function(str) {
      var chars, chr;
      chars = /[\u0000-\u0008\u000B-\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE-\uFFFF]/;
      chr = str.match(chars);
      if (chr) {
        throw new Error("Invalid character (" + chr + ") in string: " + str);
      }
    };

    XMLFragment.prototype.is = function(obj, type) {
      var clas;
      clas = Object.prototype.toString.call(obj).slice(8, -1);
      return (obj != null) && clas === type;
    };

    XMLFragment.prototype.ele = function(name, attributes, text) {
      return this.element(name, attributes, text);
    };

    XMLFragment.prototype.txt = function(value) {
      return this.text(value);
    };

    XMLFragment.prototype.dat = function(value) {
      return this.cdata(value);
    };

    XMLFragment.prototype.att = function(name, value) {
      return this.attribute(name, value);
    };

    XMLFragment.prototype.com = function(value) {
      return this.comment(value);
    };

    XMLFragment.prototype.doc = function() {
      return this.document();
    };

    XMLFragment.prototype.e = function(name, attributes, text) {
      return this.element(name, attributes, text);
    };

    XMLFragment.prototype.t = function(value) {
      return this.text(value);
    };

    XMLFragment.prototype.d = function(value) {
      return this.cdata(value);
    };

    XMLFragment.prototype.a = function(name, value) {
      return this.attribute(name, value);
    };

    XMLFragment.prototype.c = function(value) {
      return this.comment(value);
    };

    XMLFragment.prototype.r = function(value) {
      return this.raw(value);
    };

    XMLFragment.prototype.u = function() {
      return this.up();
    };

    return XMLFragment;

  })();

  module.exports = XMLFragment;

}).call(this);

},{}],75:[function(require,module,exports){
(function() {
  var XMLBuilder;

  XMLBuilder = require('./XMLBuilder');

  module.exports.create = function(name, xmldec, doctype) {
    if (name != null) {
      return new XMLBuilder(name, xmldec, doctype).root();
    } else {
      return new XMLBuilder();
    }
  };

}).call(this);

},{"./XMLBuilder":73}]},{},[1])
