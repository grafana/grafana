package notifications

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"strconv"
	"time"

	"github.com/grafana/grafana/pkg/services/user"
	"github.com/grafana/grafana/pkg/setting"
)

const (
	timeLimitStartDateLength = 12
	timeLimitMinutesLength   = 6
	timeLimitHmacLength      = 64
	timeLimitCodeLength      = timeLimitStartDateLength + timeLimitMinutesLength + timeLimitHmacLength
)

// create a time limit code
// code format: 12 length date time string + 6 minutes string + 64 HMAC-SHA256 encoded string
func createTimeLimitCode(secretKey string, payload string, minutes int, startStr string) (string, error) {
	format := "200601021504"

	var start, end time.Time
	var endStr string

	if startStr == "" {
		// Use now time create code
		start = time.Now()
		startStr = start.Format(format)
	} else {
		// use start string create code
		var err error
		start, err = time.ParseInLocation(format, startStr, time.Local)
		if err != nil {
			return "", err
		}
	}

	end = start.Add(time.Minute * time.Duration(minutes))
	endStr = end.Format(format)

	// create HMAC-SHA256 encoded string
	key := []byte(secretKey)
	h := hmac.New(sha256.New, key)
	if _, err := h.Write([]byte(payload + startStr + endStr)); err != nil {
		return "", fmt.Errorf("cannot create hmac: %v", err)
	}
	encoded := hex.EncodeToString(h.Sum(nil))

	code := fmt.Sprintf("%s%06d%s", startStr, minutes, encoded)
	return code, nil
}

// verify time limit code
func validateUserEmailCode(cfg *setting.Cfg, user *user.User, code string) (bool, error) {
	if len(code) <= 18 {
		return false, nil
	}

	code = code[:timeLimitCodeLength]

	// split code
	startStr := code[:timeLimitStartDateLength]
	minutesStr := code[timeLimitStartDateLength : timeLimitStartDateLength+timeLimitMinutesLength]
	minutes, err := strconv.Atoi(minutesStr)
	if err != nil {
		return false, fmt.Errorf("invalid time limit code: %v", err)
	}

	// right active code
	payload := strconv.FormatInt(user.ID, 10) + user.Email + user.Login + string(user.Password) + user.Rands
	expectedCode, err := createTimeLimitCode(cfg.SecretKey, payload, minutes, startStr)
	if err != nil {
		return false, err
	}
	if hmac.Equal([]byte(code), []byte(expectedCode)) && minutes > 0 {
		// check time is expired or not
		before, err := time.ParseInLocation("200601021504", startStr, time.Local)
		if err != nil {
			return false, err
		}
		now := time.Now()
		if before.Add(time.Minute*time.Duration(minutes)).Unix() > now.Unix() {
			return true, nil
		}
	}

	return false, nil
}

func getLoginForEmailCode(code string) string {
	if len(code) <= timeLimitCodeLength {
		return ""
	}

	// use tail hex username query user
	hexStr := code[timeLimitCodeLength:]
	b, _ := hex.DecodeString(hexStr)
	return string(b)
}

func createUserEmailCode(cfg *setting.Cfg, user *user.User, startStr string) (string, error) {
	minutes := cfg.EmailCodeValidMinutes
	payload := strconv.FormatInt(user.ID, 10) + user.Email + user.Login + string(user.Password) + user.Rands
	code, err := createTimeLimitCode(cfg.SecretKey, payload, minutes, startStr)
	if err != nil {
		return "", err
	}

	// add tail hex username
	code += hex.EncodeToString([]byte(user.Login))
	return code, nil
}
