package passwordimpl

import (
	"testing"

	"github.com/grafana/grafana/pkg/services/password"
	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
)

func TestPasswowrdService_ValidatePasswordHardcodePolicy(t *testing.T) {
	LOWERCASE := "lowercase"
	UPPERCASE := "UPPERCASE"
	NUMBER := "123"
	SYMBOLS := "!@#$%"
	testCases := []struct {
		expectedError error
		name          string
		passwordTest  string
	}{
		{
			name:          "should return error when the password has less than 12 characters",
			passwordTest:  NUMBER,
			expectedError: password.ErrPasswordTooShort,
		},
		{
			name:          "should return error when the password is missing an uppercase character",
			passwordTest:  LOWERCASE + NUMBER + SYMBOLS,
			expectedError: password.ErrPasswordPolicyInfringe,
		},
		{
			name:          "should return error when the password is missing a lowercase character",
			passwordTest:  UPPERCASE + NUMBER + SYMBOLS,
			expectedError: password.ErrPasswordPolicyInfringe,
		},
		{
			name:          "should return error when the password is missing a number character",
			passwordTest:  LOWERCASE + UPPERCASE + SYMBOLS,
			expectedError: password.ErrPasswordPolicyInfringe,
		},
		{
			name:          "should return error when the password is missing a symbol characters",
			passwordTest:  LOWERCASE + UPPERCASE + NUMBER,
			expectedError: password.ErrPasswordPolicyInfringe,
		},
		{
			name:          "should not return error when the password has lowercase, uppercase, number and symbol",
			passwordTest:  LOWERCASE + UPPERCASE + NUMBER + SYMBOLS,
			expectedError: nil,
		},
		{
			name:          "should not return error when the password has uppercase, number, symbol and lowercase",
			passwordTest:  UPPERCASE + NUMBER + SYMBOLS + LOWERCASE,
			expectedError: nil,
		},
		{
			name:          "should not return error when the password has number, symbol, lowercase and uppercase",
			passwordTest:  NUMBER + SYMBOLS + LOWERCASE + UPPERCASE,
			expectedError: nil,
		},
		{
			name:          "should not return error when the password has symbol, lowercase, uppercase and number",
			passwordTest:  SYMBOLS + LOWERCASE + UPPERCASE + NUMBER,
			expectedError: nil,
		},
	}
	for _, tc := range testCases {
		svc := ProvideService(setting.NewCfg()).(*service)
		err := svc.ValidatePassword([]rune(tc.passwordTest))
		assert.Equal(t, tc.expectedError, err)
	}
}
