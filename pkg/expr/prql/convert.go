package prql

import (
	"os/exec"
)

func Convert(prql string) (string, error) {
	// TODO - couldn't find a good go lib to convert prql to sql
	// duckdb extension was crashing https://github.com/ywelsch/duckdb-prql
	// this worked only with older syntax: https://github.com/pims/prql-go  ( maybe we can update it )
	// this node lib works well...¯\_(ツ)_/¯
	data, err := exec.Command("node", "./convert.js", prql).Output()
	if err != nil {
		return "", err
	}
	output := string(data)
	return output, nil
}
