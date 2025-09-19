package user

import (
	"context"
	"testing"

	iamv0alpha1 "github.com/grafana/grafana/apps/iam/pkg/apis/iam/v0alpha1"
	"github.com/stretchr/testify/require"
)

func TestMutateOnCreate_LoginEmail(t *testing.T) {
	testCases := []struct {
		name          string
		inputUser     *iamv0alpha1.User
		expectedLogin string
		expectedEmail string
	}{
		{
			name: "login and email provided with mixed case",
			inputUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "Test.User",
					Email: "Test.User@example.com",
				},
			},
			expectedLogin: "test.user",
			expectedEmail: "test.user@example.com",
		},
		{
			name: "only email provided",
			inputUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Email: "Only.Email@example.com",
				},
			},
			expectedLogin: "only.email@example.com",
			expectedEmail: "only.email@example.com",
		},
		{
			name: "only login provided",
			inputUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "Only.Login",
				},
			},
			expectedLogin: "only.login",
			expectedEmail: "only.login",
		},
		{
			name: "login and email already lowercase",
			inputUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{
					Login: "already.lower",
					Email: "already.lower@example.com",
				},
			},
			expectedLogin: "already.lower",
			expectedEmail: "already.lower@example.com",
		},
		{
			name: "both login and email are empty",
			inputUser: &iamv0alpha1.User{
				Spec: iamv0alpha1.UserSpec{},
			},
			expectedLogin: "",
			expectedEmail: "",
		},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			err := MutateOnCreate(context.Background(), tc.inputUser)
			require.NoError(t, err)
			require.Equal(t, tc.expectedLogin, tc.inputUser.Spec.Login)
			require.Equal(t, tc.expectedEmail, tc.inputUser.Spec.Email)
		})
	}
}
