package social

import (
	"testing"

	"github.com/stretchr/testify/require"
	"gopkg.in/ini.v1"
)

func TestMapping_IniSectionOAuthInfo(t *testing.T) {

	iniContent := `
[test]
client_id =          	client_id
client_secret =         client_secret
scopes =                ["openid", "profile", "email"]
auth_url = 
allow_sign_up =         false
allowed_groups = 
allowed_organizations = org1, org2
email_attribute_name = email:primary`

	iniFile, err := ini.Load([]byte(iniContent))
	require.NoError(t, err)

	expectedOAuthInfo := &OAuthInfo{
		ClientId:           "client_id",
		ClientSecret:       "client_secret",
		Scopes:             []string{"openid", "profile", "email"},
		AuthUrl:            "",
		AllowSignup:        false,
		AllowedGroups:      []string{},
		EmailAttributeName: "email:primary",
		Extra: map[string]interface{}{
			"allowed_organizations": "org1, org2",
		},
	}

	settingsKV := convertIniSectionToMap(iniFile.Section("test"))
	oauthInfo, err := createOAuthInfoFromKeyValues(settingsKV)
	require.NoError(t, err)

	require.Equal(t, expectedOAuthInfo, oauthInfo)
}
