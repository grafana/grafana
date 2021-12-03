package chats

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
	UserId  *int64
	Content string

	Created int64
	Updated int64
}

func (i Message) TableName() string {
	return "chat_message"
}
