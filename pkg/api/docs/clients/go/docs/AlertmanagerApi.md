# \AlertmanagerApi

All URIs are relative to *http://localhost/api*

Method | HTTP request | Description
------------- | ------------- | -------------
[**RouteCreateGrafanaSilence**](AlertmanagerApi.md#RouteCreateGrafanaSilence) | **Post** /alertmanager/grafana/api/v2/silences | 
[**RouteCreateSilence**](AlertmanagerApi.md#RouteCreateSilence) | **Post** /alertmanager/{Recipient}/api/v2/silences | 
[**RouteDeleteAlertingConfig**](AlertmanagerApi.md#RouteDeleteAlertingConfig) | **Delete** /alertmanager/{Recipient}/config/api/v1/alerts | 
[**RouteDeleteGrafanaAlertingConfig**](AlertmanagerApi.md#RouteDeleteGrafanaAlertingConfig) | **Delete** /alertmanager/grafana/config/api/v1/alerts | 
[**RouteDeleteGrafanaSilence**](AlertmanagerApi.md#RouteDeleteGrafanaSilence) | **Delete** /alertmanager/grafana/api/v2/silence/{SilenceId} | 
[**RouteDeleteSilence**](AlertmanagerApi.md#RouteDeleteSilence) | **Delete** /alertmanager/{Recipient}/api/v2/silence/{SilenceId} | 
[**RouteGetAMAlertGroups**](AlertmanagerApi.md#RouteGetAMAlertGroups) | **Get** /alertmanager/{Recipient}/api/v2/alerts/groups | 
[**RouteGetAMAlerts**](AlertmanagerApi.md#RouteGetAMAlerts) | **Get** /alertmanager/{Recipient}/api/v2/alerts | 
[**RouteGetAMStatus**](AlertmanagerApi.md#RouteGetAMStatus) | **Get** /alertmanager/{Recipient}/api/v2/status | 
[**RouteGetAlertingConfig**](AlertmanagerApi.md#RouteGetAlertingConfig) | **Get** /alertmanager/{Recipient}/config/api/v1/alerts | 
[**RouteGetGrafanaAMAlertGroups**](AlertmanagerApi.md#RouteGetGrafanaAMAlertGroups) | **Get** /alertmanager/grafana/api/v2/alerts/groups | 
[**RouteGetGrafanaAMAlerts**](AlertmanagerApi.md#RouteGetGrafanaAMAlerts) | **Get** /alertmanager/grafana/api/v2/alerts | 
[**RouteGetGrafanaAMStatus**](AlertmanagerApi.md#RouteGetGrafanaAMStatus) | **Get** /alertmanager/grafana/api/v2/status | 
[**RouteGetGrafanaAlertingConfig**](AlertmanagerApi.md#RouteGetGrafanaAlertingConfig) | **Get** /alertmanager/grafana/config/api/v1/alerts | 
[**RouteGetGrafanaSilence**](AlertmanagerApi.md#RouteGetGrafanaSilence) | **Get** /alertmanager/grafana/api/v2/silence/{SilenceId} | 
[**RouteGetGrafanaSilences**](AlertmanagerApi.md#RouteGetGrafanaSilences) | **Get** /alertmanager/grafana/api/v2/silences | 
[**RouteGetSilence**](AlertmanagerApi.md#RouteGetSilence) | **Get** /alertmanager/{Recipient}/api/v2/silence/{SilenceId} | 
[**RouteGetSilences**](AlertmanagerApi.md#RouteGetSilences) | **Get** /alertmanager/{Recipient}/api/v2/silences | 
[**RoutePostAMAlerts**](AlertmanagerApi.md#RoutePostAMAlerts) | **Post** /alertmanager/{Recipient}/api/v2/alerts | 
[**RoutePostAlertingConfig**](AlertmanagerApi.md#RoutePostAlertingConfig) | **Post** /alertmanager/{Recipient}/config/api/v1/alerts | 
[**RoutePostGrafanaAMAlerts**](AlertmanagerApi.md#RoutePostGrafanaAMAlerts) | **Post** /alertmanager/grafana/api/v2/alerts | 
[**RoutePostGrafanaAlertingConfig**](AlertmanagerApi.md#RoutePostGrafanaAlertingConfig) | **Post** /alertmanager/grafana/config/api/v1/alerts | 
[**RoutePostTestGrafanaReceivers**](AlertmanagerApi.md#RoutePostTestGrafanaReceivers) | **Post** /alertmanager/grafana/config/api/v1/receivers/test | Test Grafana managed receivers without saving them.
[**RoutePostTestReceivers**](AlertmanagerApi.md#RoutePostTestReceivers) | **Post** /alertmanager/{Recipient}/config/api/v1/receivers/test | Test Grafana managed receivers without saving them.


# **RouteCreateGrafanaSilence**
> GettableSilence RouteCreateGrafanaSilence(ctx, optional)


create silence

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AlertmanagerApiRouteCreateGrafanaSilenceOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRouteCreateGrafanaSilenceOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **silence** | [**optional.Interface of PostableSilence**](PostableSilence.md)|  | 

### Return type

[**GettableSilence**](gettableSilence.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteCreateSilence**
> GettableSilence RouteCreateSilence(ctx, recipient, optional)


create silence

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 
 **optional** | ***AlertmanagerApiRouteCreateSilenceOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRouteCreateSilenceOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **silence** | [**optional.Interface of PostableSilence**](PostableSilence.md)|  | 

### Return type

[**GettableSilence**](gettableSilence.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteDeleteAlertingConfig**
> Ack RouteDeleteAlertingConfig(ctx, recipient)


deletes the Alerting config for a tenant

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteDeleteGrafanaAlertingConfig**
> Ack RouteDeleteGrafanaAlertingConfig(ctx, )


deletes the Alerting config for a tenant

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteDeleteGrafanaSilence**
> Ack RouteDeleteGrafanaSilence(ctx, silenceId)


delete silence

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **silenceId** | **string**|  | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteDeleteSilence**
> Ack RouteDeleteSilence(ctx, silenceId, recipient)


delete silence

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **silenceId** | **string**|  | 
  **recipient** | **int64**| Recipient should be the numeric datasource id | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetAMAlertGroups**
> AlertGroups RouteGetAMAlertGroups(ctx, recipient, optional)


get alertmanager alerts

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 
 **optional** | ***AlertmanagerApiRouteGetAMAlertGroupsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRouteGetAMAlertGroupsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **active** | **optional.Bool**| Show active alerts | [default to true]
 **silenced** | **optional.Bool**| Show silenced alerts | [default to true]
 **inhibited** | **optional.Bool**| Show inhibited alerts | [default to true]
 **filter** | [**optional.Interface of []string**](string.md)| A list of matchers to filter alerts by | 
 **receiver** | **optional.String**| A regex matching receivers to filter alerts by | 

### Return type

[**AlertGroups**](alertGroups.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetAMAlerts**
> GettableAlerts RouteGetAMAlerts(ctx, recipient, optional)


get alertmanager alerts

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 
 **optional** | ***AlertmanagerApiRouteGetAMAlertsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRouteGetAMAlertsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **active** | **optional.Bool**| Show active alerts | [default to true]
 **silenced** | **optional.Bool**| Show silenced alerts | [default to true]
 **inhibited** | **optional.Bool**| Show inhibited alerts | [default to true]
 **filter** | [**optional.Interface of []string**](string.md)| A list of matchers to filter alerts by | 
 **receiver** | **optional.String**| A regex matching receivers to filter alerts by | 

### Return type

[**GettableAlerts**](gettableAlerts.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetAMStatus**
> GettableStatus RouteGetAMStatus(ctx, recipient)


get alertmanager status and configuration

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 

### Return type

[**GettableStatus**](GettableStatus.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetAlertingConfig**
> GettableUserConfig RouteGetAlertingConfig(ctx, recipient)


gets an Alerting config

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 

### Return type

[**GettableUserConfig**](GettableUserConfig.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetGrafanaAMAlertGroups**
> AlertGroups RouteGetGrafanaAMAlertGroups(ctx, optional)


get alertmanager alerts

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AlertmanagerApiRouteGetGrafanaAMAlertGroupsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRouteGetGrafanaAMAlertGroupsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **active** | **optional.Bool**| Show active alerts | [default to true]
 **silenced** | **optional.Bool**| Show silenced alerts | [default to true]
 **inhibited** | **optional.Bool**| Show inhibited alerts | [default to true]
 **filter** | [**optional.Interface of []string**](string.md)| A list of matchers to filter alerts by | 
 **receiver** | **optional.String**| A regex matching receivers to filter alerts by | 

### Return type

[**AlertGroups**](alertGroups.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetGrafanaAMAlerts**
> GettableAlerts RouteGetGrafanaAMAlerts(ctx, optional)


get alertmanager alerts

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AlertmanagerApiRouteGetGrafanaAMAlertsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRouteGetGrafanaAMAlertsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **active** | **optional.Bool**| Show active alerts | [default to true]
 **silenced** | **optional.Bool**| Show silenced alerts | [default to true]
 **inhibited** | **optional.Bool**| Show inhibited alerts | [default to true]
 **filter** | [**optional.Interface of []string**](string.md)| A list of matchers to filter alerts by | 
 **receiver** | **optional.String**| A regex matching receivers to filter alerts by | 

### Return type

[**GettableAlerts**](gettableAlerts.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetGrafanaAMStatus**
> GettableStatus RouteGetGrafanaAMStatus(ctx, )


get alertmanager status and configuration

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**GettableStatus**](GettableStatus.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetGrafanaAlertingConfig**
> GettableUserConfig RouteGetGrafanaAlertingConfig(ctx, )


gets an Alerting config

### Required Parameters
This endpoint does not need any parameter.

### Return type

[**GettableUserConfig**](GettableUserConfig.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetGrafanaSilence**
> GettableSilence RouteGetGrafanaSilence(ctx, silenceId)


get silence

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **silenceId** | **string**|  | 

### Return type

[**GettableSilence**](gettableSilence.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetGrafanaSilences**
> GettableSilences RouteGetGrafanaSilences(ctx, optional)


get silences

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AlertmanagerApiRouteGetGrafanaSilencesOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRouteGetGrafanaSilencesOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **filter** | [**optional.Interface of []string**](string.md)|  | 

### Return type

[**GettableSilences**](gettableSilences.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetSilence**
> GettableSilence RouteGetSilence(ctx, silenceId, recipient)


get silence

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **silenceId** | **string**|  | 
  **recipient** | **int64**| Recipient should be the numeric datasource id | 

### Return type

[**GettableSilence**](gettableSilence.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RouteGetSilences**
> GettableSilences RouteGetSilences(ctx, recipient, optional)


get silences

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 
 **optional** | ***AlertmanagerApiRouteGetSilencesOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRouteGetSilencesOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **filter** | [**optional.Interface of []string**](string.md)|  | 

### Return type

[**GettableSilences**](gettableSilences.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RoutePostAMAlerts**
> Ack RoutePostAMAlerts(ctx, recipient, optional)


create alertmanager alerts

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 
 **optional** | ***AlertmanagerApiRoutePostAMAlertsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRoutePostAMAlertsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **postableAlerts** | [**optional.Interface of []PostableAlert**](postableAlert.md)|  | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RoutePostAlertingConfig**
> Ack RoutePostAlertingConfig(ctx, recipient, optional)


sets an Alerting config

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 
 **optional** | ***AlertmanagerApiRoutePostAlertingConfigOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRoutePostAlertingConfigOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **body** | [**optional.Interface of PostableUserConfig**](PostableUserConfig.md)|  | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RoutePostGrafanaAMAlerts**
> Ack RoutePostGrafanaAMAlerts(ctx, optional)


create alertmanager alerts

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AlertmanagerApiRoutePostGrafanaAMAlertsOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRoutePostGrafanaAMAlertsOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **postableAlerts** | [**optional.Interface of []PostableAlert**](postableAlert.md)|  | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RoutePostGrafanaAlertingConfig**
> Ack RoutePostGrafanaAlertingConfig(ctx, optional)


sets an Alerting config

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AlertmanagerApiRoutePostGrafanaAlertingConfigOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRoutePostGrafanaAlertingConfigOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | [**optional.Interface of PostableUserConfig**](PostableUserConfig.md)|  | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RoutePostTestGrafanaReceivers**
> Ack RoutePostTestGrafanaReceivers(ctx, optional)
Test Grafana managed receivers without saving them.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
 **optional** | ***AlertmanagerApiRoutePostTestGrafanaReceiversOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRoutePostTestGrafanaReceiversOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **body** | [**optional.Interface of TestReceiversConfigBodyParams**](TestReceiversConfigBodyParams.md)|  | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

# **RoutePostTestReceivers**
> Ack RoutePostTestReceivers(ctx, recipient, optional)
Test Grafana managed receivers without saving them.

### Required Parameters

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------
 **ctx** | **context.Context** | context for authentication, logging, cancellation, deadlines, tracing, etc.
  **recipient** | **int64**| Recipient should be the numeric datasource id | 
 **optional** | ***AlertmanagerApiRoutePostTestReceiversOpts** | optional parameters | nil if no parameters

### Optional Parameters
Optional parameters are passed through a pointer to a AlertmanagerApiRoutePostTestReceiversOpts struct

Name | Type | Description  | Notes
------------- | ------------- | ------------- | -------------

 **body** | [**optional.Interface of TestReceiversConfigBodyParams**](TestReceiversConfigBodyParams.md)|  | 

### Return type

[**Ack**](Ack.md)

### Authorization

[api_key](../README.md#api_key), [basic](../README.md#basic)

### HTTP request headers

 - **Content-Type**: application/json
 - **Accept**: application/json

[[Back to top]](#) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to Model list]](../README.md#documentation-for-models) [[Back to README]](../README.md)

