package models

type DeleteExpiredAnnotationsCommand struct {
	DaysToKeep  int
	DeletedRows int64
}
