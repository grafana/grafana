// Package pq is a pure Go openGauss driver for the database/sql package.

//go:build js || android || hurd || zos
// +build js android hurd zos

package pq

func userCurrent() (string, error) {
	return "", ErrCouldNotDetectUsername
}
