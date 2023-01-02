package notifications

import (
	"fmt"
	"strconv"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

func TestTimeLimitCodes(t *testing.T) {
	cfg := setting.NewCfg()
	cfg.EmailCodeValidMinutes = 120
	user := &user.User{ID: 10, Email: "t@a.com", Login: "asd", Password: "1", Rands: "2"}

	format := "200601021504"
	mailPayload := strconv.FormatInt(user.ID, 10) + user.Email + user.Login + user.Password + user.Rands
	tenMinutesAgo := time.Now().Add(-time.Minute * 10)

	tests := []struct {
		desc    string
		payload string
		start   time.Time
		minutes int
		valid   bool
	}{
		{
			desc:    "code generated 10 minutes ago, 5 minutes valid",
			payload: mailPayload,
			start:   tenMinutesAgo,
			minutes: 5,
			valid:   false,
		},
		{
			desc:    "code generated 10 minutes ago, 9 minutes valid",
			payload: mailPayload,
			start:   tenMinutesAgo,
			minutes: 9,
			valid:   false,
		},
		{
			desc:    "code generated 10 minutes ago, 10 minutes valid",
			payload: mailPayload,
			start:   tenMinutesAgo,
			minutes: 10,
			// code was valid exactly 10 minutes since evaluating the tenMinutesAgo assignment
			// by the time this test is run the code is already expired
			valid: false,
		},
		{
			desc:    "code generated 10 minutes ago, 11 minutes valid",
			payload: mailPayload,
			start:   tenMinutesAgo,
			minutes: 11,
			valid:   true,
		},
		{
			desc:    "code generated 10 minutes ago, 20 minutes valid",
			payload: mailPayload,
			start:   tenMinutesAgo,
			minutes: 20,
			valid:   true,
		},
		{
			desc:    "code generated 10 minutes ago, 20 minutes valid, tampered payload",
			payload: mailPayload[:len(mailPayload)-1] + "x",
			start:   tenMinutesAgo,
			minutes: 20,
			valid:   false,
		},
	}

	for _, test := range tests {
		t.Run(test.desc, func(t *testing.T) {
			code, err := createTimeLimitCode(test.payload, test.minutes, test.start.Format(format))
			require.NoError(t, err)

			isValid, err := validateUserEmailCode(cfg, user, code)
			require.NoError(t, err)
			require.Equal(t, test.valid, isValid)
		})
	}

	t.Run("tampered minutes", func(t *testing.T) {
		code, err := createTimeLimitCode(mailPayload, 5, tenMinutesAgo.Format(format))
		require.NoError(t, err)

		// code is expired
		isValid, err := validateUserEmailCode(cfg, user, code)
		require.NoError(t, err)
		require.Equal(t, false, isValid)

		// let's try to extend the code by tampering the minutes
		code = code[:12] + fmt.Sprintf("%06d", 20) + code[18:]
		isValid, err = validateUserEmailCode(cfg, user, code)
		require.NoError(t, err)
		require.Equal(t, false, isValid)
	})

	t.Run("tampered start string", func(t *testing.T) {
		code, err := createTimeLimitCode(mailPayload, 5, tenMinutesAgo.Format(format))
		require.NoError(t, err)

		// code is expired
		isValid, err := validateUserEmailCode(cfg, user, code)
		require.NoError(t, err)
		require.Equal(t, false, isValid)

		// let's try to extend the code by tampering the start string
		oneMinuteAgo := time.Now().Add(-time.Minute)

		code = oneMinuteAgo.Format(format) + code[12:]
		isValid, err = validateUserEmailCode(cfg, user, code)
		require.NoError(t, err)
		require.Equal(t, false, isValid)
	})
}

func TestEmailCodes(t *testing.T) {
	t.Run("When generating code", func(t *testing.T) {
		cfg := setting.NewCfg()
		cfg.EmailCodeValidMinutes = 120

		user := &user.User{ID: 10, Email: "t@a.com", Login: "asd", Password: "1", Rands: "2"}
		code, err := createUserEmailCode(cfg, user, "")
		require.NoError(t, err)

		t.Run("getLoginForCode should return login", func(t *testing.T) {
			login := getLoginForEmailCode(code)
			require.Equal(t, "asd", login)
		})

		t.Run("Can verify valid code", func(t *testing.T) {
			isValid, err := validateUserEmailCode(cfg, user, code)
			require.NoError(t, err)
			require.True(t, isValid)
		})

		t.Run("Cannot verify invalid code", func(t *testing.T) {
			code = "ASD"
			isValid, err := validateUserEmailCode(cfg, user, code)
			require.NoError(t, err)
			require.False(t, isValid)
		})
	})
}
