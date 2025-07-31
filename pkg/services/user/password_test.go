package user

import (
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestPasswowrdService_ValidatePasswordHardcodePolicy(t *testing.T) {
	LOWERCASE := "lowercase"
	UPPERCASE := "UPPERCASE"
	NUMBER := "123"
	SYMBOLS := "!@#$%"
	testCases := []struct {
		expectedError               error
		name                        string
		passwordTest                string
		strongPasswordPolicyEnabled bool
	}{
		{
			name:                        "should return error when the password has less than 4 characters and strong password policy is disabled",
			passwordTest:                NUMBER,
			expectedError:               ErrPasswordTooShort.Errorf("new password is too short"),
			strongPasswordPolicyEnabled: false,
		},
		{
			name:                        "should not return error when the password has 4 characters and strong password policy is disabled",
			passwordTest:                "test",
			expectedError:               nil,
			strongPasswordPolicyEnabled: false,
		},
		{
			name:                        "should return error when the password has less than 12 characters and strong password policy is enabled",
			passwordTest:                NUMBER,
			expectedError:               ErrPasswordPolicyInfringe.Errorf("new password is too short for the strong password policy"),
			strongPasswordPolicyEnabled: true,
		},
		{
			name:                        "should return error when the password is missing an uppercase character and strong password policy is enabled",
			passwordTest:                LOWERCASE + NUMBER + SYMBOLS,
			expectedError:               ErrPasswordPolicyInfringe.Errorf("new password doesn't comply with the password policy"),
			strongPasswordPolicyEnabled: true,
		},
		{
			name:                        "should return error when the password is missing a lowercase character and strong password policy is enabled",
			passwordTest:                UPPERCASE + NUMBER + SYMBOLS,
			expectedError:               ErrPasswordPolicyInfringe.Errorf("new password doesn't comply with the password policy"),
			strongPasswordPolicyEnabled: true,
		},
		{
			name:                        "should return error when the password is missing a number character and strong password policy is enabled",
			passwordTest:                LOWERCASE + UPPERCASE + SYMBOLS,
			expectedError:               ErrPasswordPolicyInfringe.Errorf("new password doesn't comply with the password policy"),
			strongPasswordPolicyEnabled: true,
		},
		{
			name:                        "should return error when the password is missing a symbol characters and strong password policy is enabled",
			passwordTest:                LOWERCASE + UPPERCASE + NUMBER,
			expectedError:               ErrPasswordPolicyInfringe.Errorf("new password doesn't comply with the password policy"),
			strongPasswordPolicyEnabled: true,
		},
		{
			name:                        "should not return error when the password has lowercase, uppercase, number and symbol and strong password policy is enabled",
			passwordTest:                LOWERCASE + UPPERCASE + NUMBER + SYMBOLS,
			expectedError:               nil,
			strongPasswordPolicyEnabled: true,
		},
		{
			name:                        "should not return error when the password has uppercase, number, symbol and lowercase and strong password policy is enabled",
			passwordTest:                UPPERCASE + NUMBER + SYMBOLS + LOWERCASE,
			expectedError:               nil,
			strongPasswordPolicyEnabled: true,
		},
		{
			name:                        "should not return error when the password has number, symbol, lowercase and uppercase and strong password policy is enabled",
			passwordTest:                NUMBER + SYMBOLS + LOWERCASE + UPPERCASE,
			expectedError:               nil,
			strongPasswordPolicyEnabled: true,
		},
		{
			name:                        "should not return error when the password has symbol, lowercase, uppercase and number and strong password policy is enabled",
			passwordTest:                SYMBOLS + LOWERCASE + UPPERCASE + NUMBER,
			expectedError:               nil,
			strongPasswordPolicyEnabled: true,
		},
	}
	for _, tc := range testCases {
		cfg := setting.NewCfg()
		cfg.BasicAuthStrongPasswordPolicy = tc.strongPasswordPolicyEnabled
		err := ValidatePassword(tc.passwordTest, setting.ProvideService(cfg))
		assert.Equal(t, tc.expectedError, err)
	}
}
