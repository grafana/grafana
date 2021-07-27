package azcredentials

import (
	"fmt"
)

func FromDatasourceData(data map[string]interface{}, secureData map[string]string) (AzureCredentials, error) {
	if credentialsObj, err := getMapOptional(data, "azureCredentials"); err != nil {
		return nil, err
	} else if credentialsObj == nil {
		return nil, nil
	} else {
		return getFromCredentialsObject(credentialsObj, secureData)
	}
}

func getFromCredentialsObject(credentialsObj map[string]interface{}, secureData map[string]string) (AzureCredentials, error) {
	authType, err := getStringValue(credentialsObj, "authType")
	if err != nil {
		return nil, err
	}

	switch authType {
	case AzureAuthManagedIdentity:
		credentials := &AzureManagedIdentityCredentials{}
		return credentials, nil

	case AzureAuthClientSecret:
		cloud, err := getStringValue(credentialsObj, "azureCloud")
		if err != nil {
			return nil, err
		}
		tenantId, err := getStringValue(credentialsObj, "tenantId")
		if err != nil {
			return nil, err
		}
		clientId, err := getStringValue(credentialsObj, "clientId")
		if err != nil {
			return nil, err
		}
		clientSecret := secureData["azureClientSecret"]

		credentials := &AzureClientSecretCredentials{
			AzureCloud:   cloud,
			TenantId:     tenantId,
			ClientId:     clientId,
			ClientSecret: clientSecret,
		}
		return credentials, nil

	default:
		err := fmt.Errorf("the authentication type '%s' not supported", authType)
		return nil, err
	}
}

func getMapOptional(obj map[string]interface{}, key string) (map[string]interface{}, error) {
	if untypedValue, ok := obj[key]; ok {
		if value, ok := untypedValue.(map[string]interface{}); ok {
			return value, nil
		} else {
			err := fmt.Errorf("the field '%s' should be an object", key)
			return nil, err
		}
	} else {
		// Value optional, not error
		return nil, nil
	}
}

func getStringValue(obj map[string]interface{}, key string) (string, error) {
	if untypedValue, ok := obj[key]; ok {
		if value, ok := untypedValue.(string); ok {
			return value, nil
		} else {
			err := fmt.Errorf("the field '%s' should be a string", key)
			return "", err
		}
	} else {
		err := fmt.Errorf("the field '%s' should be set", key)
		return "", err
	}
}
