package nameutil

import (
	"crypto/md5"
	"fmt"
)

// SanitizeSAName is used for sanitize name and it's length for service accounts.
// Max length of service account name is 190 chars (limit in Grafana Postgres DB).
// However, prefix added by grafana is counted too. Prefix is sa-{orgID}-.
// Bare minimum is 5 chars reserved (orgID is <10, like sa-1-) and could be more depends
// on orgID number. Let's reserve 10 chars. It will cover almost one million orgIDs.
// Sanitizing, ensure its length by hashing postfix when length is exceeded.
// MD5 is used because it has fixed length 32 chars.
//
// Be aware that the same method is implemented in the PMM repo, and all changes should be reflected there as well!
func SanitizeSAName(name string) string {
	if len(name) <= 180 {
		return name
	}

	return fmt.Sprintf("%s%x", name[:148], md5.Sum([]byte(name[148:]))) //nolint:gosec
}
