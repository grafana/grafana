package category

type Repository interface {
	Save(item *Item) error
	Update(item *Item) error
	Delete(params *DeleteParams) error
	Find(query *FindParams) ([]*Item, error)
}

var repositoryInstance Repository

func GetRepository() Repository {
	return repositoryInstance
}

func SetRepository(rep Repository) {
	repositoryInstance = rep
}

type FindParams struct {
	OrgId  int64 `json:"orgId"`
	UserId int64 `json:"userId"`
	Limit  int64 `json:"limit"`
}

type DeleteParams struct {
	Id   int64  `json:"id"`
	Name string `json:"title"`
}

type ItemType string

type Item struct {
	Id          int64  `json:"id"`
	OrgId       int64  `json:"orgId"`
	UserId      int64  `json:"userId"`
	Name        string `json:"title"`
	Description string `json:"text"`
}
