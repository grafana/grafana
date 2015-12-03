package models

type PluginBundle struct {
	Id      int64
	Type    string
	Org     int64
	Enabled bool
}
