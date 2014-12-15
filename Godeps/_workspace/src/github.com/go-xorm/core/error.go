package core

import "errors"

var (
	ErrNoMapPointer    = errors.New("mp should be a map's pointer")
	ErrNoStructPointer = errors.New("mp should be a map's pointer")
	//ErrNotExist        = errors.New("Not exist")
	//ErrIgnore = errors.New("Ignore")
)
