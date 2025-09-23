package pipeline

import "context"

// Storage describes all methods to manage Live pipeline persistent data.
type Storage interface {
	ListWriteConfigs(_ context.Context, orgID int64) ([]WriteConfig, error)
	GetWriteConfig(_ context.Context, orgID int64, cmd WriteConfigGetCmd) (WriteConfig, bool, error)
	CreateWriteConfig(_ context.Context, orgID int64, cmd WriteConfigCreateCmd) (WriteConfig, error)
	UpdateWriteConfig(_ context.Context, orgID int64, cmd WriteConfigUpdateCmd) (WriteConfig, error)
	DeleteWriteConfig(_ context.Context, orgID int64, cmd WriteConfigDeleteCmd) error
	ListChannelRules(_ context.Context, orgID int64) ([]ChannelRule, error)
	CreateChannelRule(_ context.Context, orgID int64, cmd ChannelRuleCreateCmd) (ChannelRule, error)
	UpdateChannelRule(_ context.Context, orgID int64, cmd ChannelRuleUpdateCmd) (ChannelRule, error)
	DeleteChannelRule(_ context.Context, orgID int64, cmd ChannelRuleDeleteCmd) error
}
