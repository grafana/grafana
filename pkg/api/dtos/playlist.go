package dtos

type PlaylistDashboard struct {
	Id    int64  `json:"id"`
	Slug  string `json:"slug"`
	Title string `json:"title"`
	Uri   string `json:"uri"`
	Url   string `json:"url"`
	Order int    `json:"order"`
}

type PlaylistDashboardsSlice []PlaylistDashboard

func (slice PlaylistDashboardsSlice) Len() int {
	return len(slice)
}

func (slice PlaylistDashboardsSlice) Less(i, j int) bool {
	return slice[i].Order < slice[j].Order
}

func (slice PlaylistDashboardsSlice) Swap(i, j int) {
	slice[i], slice[j] = slice[j], slice[i]
}
