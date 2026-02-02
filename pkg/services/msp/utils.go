package msp

import (
	"strconv"
)

func Includes(id int64, ids []int64) bool {
	for _, i := range ids {
		if i == id {
			return true
		}
	}
	return false
}

func GetUnrestrictedTeamID(id int64) int64 {

	concatenated := "99000" + strconv.FormatInt(id, 10)

	value, err := strconv.ParseInt(concatenated, 10, 64)
	if err != nil {
		return 0
	}
	return value
}
