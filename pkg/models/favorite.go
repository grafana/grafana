package models

type Favorite struct {
	Id          int64
	UserId      int64
	DashboardId int64
}

// ----------------------
// COMMANDS

type AddAsFavoriteCommand struct {
	UserId      int64
	DashboardId int64
}

type RemoveAsFavoriteCommand struct {
	UserId      int64
	DashboardId int64
}

// ---------------------
// QUERIES

type GetUserFavoritesQuery struct {
	UserId int64

	Result []Favorite
}
