package pipeline

import "context"

// Storage describes all methods to manage Live pipeline persistent data.
type Storage interface {
	ListWriteConfigs(_ context.Context, ns string) ([]WriteConfig, error)
	GetWriteConfig(_ context.Context, ns string, cmd WriteConfigGetCmd) (WriteConfig, bool, error)
	CreateWriteConfig(_ context.Context, ns string, cmd WriteConfigCreateCmd) (WriteConfig, error)
	UpdateWriteConfig(_ context.Context, ns string, cmd WriteConfigUpdateCmd) (WriteConfig, error)
	DeleteWriteConfig(_ context.Context, ns string, cmd WriteConfigDeleteCmd) error
	ListChannelRules(_ context.Context, ns string) ([]ChannelRule, error)
	CreateChannelRule(_ context.Context, ns string, cmd ChannelRuleCreateCmd) (ChannelRule, error)
	UpdateChannelRule(_ context.Context, ns string, cmd ChannelRuleUpdateCmd) (ChannelRule, error)
	DeleteChannelRule(_ context.Context, ns string, cmd ChannelRuleDeleteCmd) error
}
