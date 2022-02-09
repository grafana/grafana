package chatmodel

const (
	// ContentTypeOrg is reserved for future use for per-org discussions.
	ContentTypeOrg = 1
	// ContentTypeDashboard used for dashboard-wide discussions.
	ContentTypeDashboard = 2
	// ContentTypeAnnotation used for annotation discussions.
	ContentTypeAnnotation = 3
)

var RegisteredContentTypes = map[int]struct{}{
	ContentTypeOrg:        {},
	ContentTypeDashboard:  {},
	ContentTypeAnnotation: {},
}

type Chat struct {
	Id            int64
	OrgId         int64
	ContentTypeId int
	ObjectId      string
	Settings      string

	Created int64
	Updated int64
}

func (i Chat) TableName() string {
	return "chat"
}

type Message struct {
	Id      int64
	ChatId  int64
	UserId  int64
	Content string

	Created int64
	Updated int64
}

type MessageUser struct {
	Id        int64  `json:"id"`
	Name      string `json:"name"`
	Login     string `json:"login"`
	Email     string `json:"email"`
	AvatarUrl string `json:"avatarUrl"`
}

type MessageDto struct {
	Id      int64        `json:"id"`
	UserId  int64        `json:"userId"`
	Content string       `json:"content"`
	Created int64        `json:"created"`
	User    *MessageUser `json:"user,omitempty"`
}

func (i Message) ToDTO(user *MessageUser) *MessageDto {
	return &MessageDto{
		Id:      i.Id,
		UserId:  i.UserId,
		Content: i.Content,
		Created: i.Created,
		User:    user,
	}
}

func (i Message) TableName() string {
	return "chat_message"
}
