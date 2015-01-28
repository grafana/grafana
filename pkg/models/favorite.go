package models

type Favorite struct {
	Id          int64
	UserId      int64
	DashboardId int64
}

type AddAsFavoriteCommand struct {
	UserId      int64
	DashboardId int64
}

type RemoveAsFavoriteCommand struct {
	UserId      int64
	DashboardId int64
}
