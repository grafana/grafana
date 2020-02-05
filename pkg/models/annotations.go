package models

type DeleteExpiredVAnnotationsCommand struct {
	DaysToKeep  int
	DeletedRows int64
}
