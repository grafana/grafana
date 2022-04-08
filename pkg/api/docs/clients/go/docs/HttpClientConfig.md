# HttpClientConfig

## Properties
Name | Type | Description | Notes
------------ | ------------- | ------------- | -------------
**Authorization** | [***Authorization**](Authorization.md) |  | [optional] [default to null]
**BasicAuth** | [***BasicAuth**](BasicAuth.md) |  | [optional] [default to null]
**BearerToken** | [***Secret**](Secret.md) |  | [optional] [default to null]
**BearerTokenFile** | **string** | The bearer token file for the targets. Deprecated in favour of Authorization.CredentialsFile. | [optional] [default to null]
**FollowRedirects** | **bool** | FollowRedirects specifies whether the client should follow HTTP 3xx redirects. The omitempty flag is not set, because it would be hidden from the marshalled configuration when set to false. | [optional] [default to null]
**Oauth2** | [***OAuth2**](OAuth2.md) |  | [optional] [default to null]
**ProxyUrl** | [***Url**](URL.md) |  | [optional] [default to null]
**TlsConfig** | [***TlsConfig**](TLSConfig.md) |  | [optional] [default to null]

[[Back to Model list]](../README.md#documentation-for-models) [[Back to API list]](../README.md#documentation-for-api-endpoints) [[Back to README]](../README.md)


