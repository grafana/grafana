package notifications

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/Unknwon/com"
	m "github.com/wangy1931/grafana/pkg/models"
	"github.com/wangy1931/grafana/pkg/setting"
)

const timeLimitCodeLength = 12 + 6 + 40

// create a time limit code
// code format: 12 length date time string + 6 minutes string + 40 sha1 encoded string
func createTimeLimitCode(data string, minutes int, startInf interface{}) string {
	format := "200601021504"

	var start, end time.Time
	var startStr, endStr string

	if startInf == nil {
		// Use now time create code
		start = time.Now()
		startStr = start.Format(format)
	} else {
		// use start string create code
		startStr = startInf.(string)
		start, _ = time.ParseInLocation(format, startStr, time.Local)
		startStr = start.Format(format)
	}

	end = start.Add(time.Minute * time.Duration(minutes))
	endStr = end.Format(format)

	// create sha1 encode string
	sh := sha1.New()
	sh.Write([]byte(data + setting.SecretKey + startStr + endStr + com.ToStr(minutes)))
	encoded := hex.EncodeToString(sh.Sum(nil))

	code := fmt.Sprintf("%s%06d%s", startStr, minutes, encoded)
	return code
}

// verify time limit code
func validateUserEmailCode(user *m.User, code string) bool {
	if len(code) <= 18 {
		return false
	}

	minutes := setting.EmailCodeValidMinutes
	code = code[:timeLimitCodeLength]

	// split code
	start := code[:12]
	lives := code[12:18]
	if d, err := com.StrTo(lives).Int(); err == nil {
		minutes = d
	}

	// right active code
	data := com.ToStr(user.Id) + user.Email + user.Login + user.Password + user.Rands
	retCode := createTimeLimitCode(data, minutes, start)
	fmt.Printf("code : %s\ncode2: %s", retCode, code)
	if retCode == code && minutes > 0 {
		// check time is expired or not
		before, _ := time.ParseInLocation("200601021504", start, time.Local)
		now := time.Now()
		if before.Add(time.Minute*time.Duration(minutes)).Unix() > now.Unix() {
			return true
		}
	}

	return false
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

func createUserEmailCode(u *m.User, startInf interface{}) string {
	minutes := setting.EmailCodeValidMinutes
	data := com.ToStr(u.Id) + u.Email + u.Login + u.Password + u.Rands
	code := createTimeLimitCode(data, minutes, startInf)

	// add tail hex username
	code += hex.EncodeToString([]byte(u.Login))
	return code
}
