//go:build enterprise || pro
// +build enterprise pro

package setting

func init() {
	IsEnterprise = true
}
